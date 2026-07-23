/*
 * Service worker for the Assessment Recorders PWA.
 *
 * Goal: the app must open and work with no network at all once it has been
 * loaded online a single time (e.g. right after "Add to Home Screen").
 *
 * Strategy:
 *   - Precache the whole app shell on install (HTML + all vendored JS/CSS/
 *     fonts/icons). There are no cross-origin requests, so a full precache
 *     makes the app usable offline immediately.
 *   - HTML navigations: network-first, falling back to the cached page. This
 *     lets an online launch pick up a newer deploy while still working offline.
 *   - Everything else (stable, effectively versioned assets): cache-first.
 *
 * Bump CACHE_VERSION whenever the shell file list changes so old caches are
 * cleared on the next visit.
 */
const CACHE_VERSION = "assess-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/react.production.min.js",
  "./assets/react-dom.production.min.js",
  "./assets/babel.min.js",
  "./assets/jspdf.umd.min.js",
  "./assets/tailwind.js",
  "./assets/fonts.css",
  "./assets/fonts/karla-v33-qkB9XvYC6trAT55ZBi1ueQVIjQTD-JrIH2G7nytkHRyQ8p4wUje6bmMorHA.woff2",
  "./assets/fonts/karla-v33-qkB9XvYC6trAT55ZBi1ueQVIjQTD-JrIH2G7nytkHRyQ8p4wUjm6bmMorHBiTg.woff2",
  "./assets/fonts/karla-v33-qkBKXvYC6trAT7RQNNK2EG7SIwPWMNlCV3lGb7P1GAGQytc.woff2",
  "./assets/fonts/karla-v33-qkBKXvYC6trAT7RQNNK2EG7SIwPWMNlCV3lIb7P1GAGQ.woff2",
  "./assets/fonts/youngserif-v2-3qTpojO2nS2VtkB3KtkQZ1t93kY6ah7E.woff2",
  "./assets/fonts/youngserif-v2-3qTpojO2nS2VtkB3KtkQZ1tz3kY6ah7ECjE.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no cross-origin requests expected

  const isHTML =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // Network-first so an online launch gets the latest deploy; cache fallback offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
