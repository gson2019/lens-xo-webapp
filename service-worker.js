var CACHE_NAME = "tic-tac-toe-v1";
var CACHE_URLS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "lens-xo.webmanifest",
  "favicon.png",
  "lens-xo-icon.png",
  "lens-xo-launcher-128.png",
  "lens-xo-launcher-192.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_URLS);
    })
  );
});

self.addEventListener("fetch", function(event) {
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request);
    })
  );
});
