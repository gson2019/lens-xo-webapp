// Optional offline cache for Car Hunter.
// NOTE: app.js does not register this SW by default. Register it only after you
// self-host the detector (useLocalVendor = true) so the model is cached offline:
//   if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
var CACHE_NAME = "car-hunter-v1";
var CACHE_URLS = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "lens-xo.webmanifest",
  "lens-xo-launcher-128.png",
  "lens-xo-launcher-192.png"
  // When self-hosting, add the vendor + model files so the game works offline:
  // "vendor/tf.min.js",
  // "vendor/coco-ssd.min.js",
  // "models/coco-ssd-lite/model.json",
  // ...group1-shard*of* weight files
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_URLS);
    })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
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
