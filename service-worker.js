// Car Hunter service worker.
// Goal: download the ~18MB coco-ssd model ONCE, then serve it from cache on every
// relaunch so the detector loads instantly (and offline) instead of re-fetching.
//
// Strategy:
//   - App shell (html/js/css/manifest/icons): network-first, fall back to cache.
//   - Model + runtime (/vendor/, /models/): cache-first (immutable, big).
var CACHE = "car-hunter-v2";

var SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "lens-xo.webmanifest",
  "lens-xo-launcher-128.png",
  "lens-xo-launcher-192.png"
];

self.addEventListener("install", function(event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function(cache) { return cache.addAll(SHELL); }));
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.filter(function(k) { return k !== CACHE; })
                               .map(function(k) { return caches.delete(k); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

function isModelAsset(url) {
  return url.pathname.indexOf("/vendor/") !== -1 || url.pathname.indexOf("/models/") !== -1;
}

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);

  if (isModelAsset(url)) {
    // cache-first: model/runtime never change, so serve from cache and only hit
    // the network the very first time.
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(resp) {
          if (resp && resp.ok) {
            var copy = resp.clone();
            caches.open(CACHE).then(function(c) { c.put(event.request, copy); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // app shell: network-first (stay fresh across deploys), fall back to cache offline.
  event.respondWith(
    fetch(event.request)
      .then(function(resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(event.request, copy); });
        }
        return resp;
      })
      .catch(function() { return caches.match(event.request); })
  );
});
