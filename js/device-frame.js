/* Desktop viewing: show the mobile site inside a phone frame.
   On a desktop-width window this page doesn't render its own layout. It shows
   a phone-shaped frame and loads the same page inside it at phone width, so
   the mobile layout (and everything built for it) runs as on a real phone.
   Phones and narrow windows are untouched. Loaded first, in <head>, so the
   desktop layout never flashes. */
(function () {
  "use strict";
  var html = document.documentElement;
  var wide = window.matchMedia("(min-width: 721px)");

  // Inside the phone frame: mark it (hides the scrollbar, see site.css) and stop
  if (window.self !== window.top) { html.classList.add("in-device"); return; }
  if (!wide.matches) return;

  html.classList.add("is-device"); // site.css hides the page; page scripts skip their work
  document.addEventListener("DOMContentLoaded", function () {
    var device = document.createElement("div");
    device.className = "device";
    var screen = document.createElement("div");
    screen.className = "device-screen";
    var frame = document.createElement("iframe");
    frame.title = "Big Blue Bus, mobile prototype";
    // A marker in the URL: browsers won't load a frame at its parent's exact address
    var url = new URL(window.location.href);
    url.searchParams.set("device", "1");
    frame.src = url.pathname + url.search + url.hash;
    screen.appendChild(frame);
    device.appendChild(screen);
    document.body.appendChild(device);

    // Keep the address bar and tab title in step with the page shown in the phone,
    // so a reload or a copied link opens the same screen
    frame.addEventListener("load", function () {
      try {
        var inner = new URL(frame.contentWindow.location.href);
        inner.searchParams.delete("device");
        window.history.replaceState(null, "", inner.pathname + inner.search + inner.hash);
        document.title = frame.contentDocument.title;
      } catch (e) { /* not readable: leave the address as is */ }
    });
  });

  // Window narrowed to phone width: show the real mobile page instead of the frame
  var onChange = function (e) { if (!e.matches) window.location.reload(); };
  if (wide.addEventListener) wide.addEventListener("change", onChange);
  else if (wide.addListener) wide.addListener(onChange);
})();
