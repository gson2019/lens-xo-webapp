(function() {
  "use strict";

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  var CONFIG = {
    // Where TF.js + coco-ssd come from.
    // CDN (default) works out of the box for browser + on-device testing.
    // For production on the glasses (offline + WebView domain lock-down) run
    // scripts/fetch-vendor.sh and flip useLocalVendor to true so everything is
    // served from THIS app's own origin.
    useLocalVendor: false,
    vendorCDN: {
      tfjs: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
      cocoSsd: "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"
    },
    vendorLocal: {
      tfjs: "vendor/tf.min.js",
      cocoSsd: "vendor/coco-ssd.min.js"
    },
    localModelUrl: "models/coco-ssd-lite/model.json", // only used when useLocalVendor
    modelBase: "lite_mobilenet_v2",  // smallest coco-ssd backbone — best for glasses
    captureWidth: 320,               // downscale before inference (memory + speed)
    minScore: 0.6,                   // confidence threshold
    targets: ["car"],                // COCO classes that count. Widen for a
                                     // "vehicle" game: ["car","truck","bus","motorcycle"]
    resultMs: 2200
  };

  var STORAGE_KEY = "car_hunter_stats_v1";

  var state = {
    phase: "idle",        // idle | capturing | result
    model: null,
    stream: null,
    cameraReady: false,
    stats: { caught: 0, shots: 0 }
  };

  var modelPromise = null;
  var toastTimer = null;
  var resultTimer = null;
  var workCanvas = document.createElement("canvas");

  // ---------------------------------------------------------------------------
  // Stats persistence
  // ---------------------------------------------------------------------------
  function loadStats() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) Object.assign(state.stats, JSON.parse(saved));
    } catch (error) {
      console.warn("Could not load stats", error);
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.stats));
    } catch (error) {
      console.warn("Could not save stats", error);
    }
  }

  // ---------------------------------------------------------------------------
  // Small DOM helpers
  // ---------------------------------------------------------------------------
  function byId(id) { return document.getElementById(id); }

  function setText(id, text) {
    var el = byId(id);
    if (el) el.textContent = text;
  }

  function render() {
    setText("caught-score", state.stats.caught);
    setText("shots-score", state.stats.shots);
  }

  function setViewStatus(text) {
    setText("vf-status", text);
  }

  function setDetector(status) {
    var pill = byId("detector-pill");
    if (!pill) return;
    pill.classList.remove("ready", "error");
    if (status === "loading") pill.textContent = "Detector: loading…";
    if (status === "ready") { pill.textContent = "Detector: ready"; pill.classList.add("ready"); }
    if (status === "error") { pill.textContent = "Detector: error"; pill.classList.add("error"); }
  }

  function disableCapture(disabled) {
    var btn = byId("capture-btn");
    if (btn) {
      if (disabled) btn.setAttribute("disabled", "true");
      else btn.removeAttribute("disabled");
    }
  }

  function showToast(message) {
    var toast = byId("toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(function() { toast.classList.remove("visible"); }, 2000);
  }

  // ---------------------------------------------------------------------------
  // Model loading (lazy + warmed up)
  // ---------------------------------------------------------------------------
  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function() { resolve(); };
      s.onerror = function() { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  function warmup(model) {
    var c = document.createElement("canvas");
    c.width = CONFIG.captureWidth;
    c.height = CONFIG.captureWidth;
    return model.detect(c).then(function() { return model; });
  }

  function ensureModel() {
    if (modelPromise) return modelPromise;
    setDetector("loading");
    var vendor = CONFIG.useLocalVendor ? CONFIG.vendorLocal : CONFIG.vendorCDN;

    modelPromise = loadScript(vendor.tfjs)
      .then(function() { return loadScript(vendor.cocoSsd); })
      .then(function() {
        var opts = { base: CONFIG.modelBase };
        if (CONFIG.useLocalVendor) opts.modelUrl = CONFIG.localModelUrl;
        return window.cocoSsd.load(opts);
      })
      .then(warmup)
      .then(function(model) {
        state.model = model;
        setDetector("ready");
        return model;
      })
      .catch(function(error) {
        modelPromise = null; // allow retry on next capture
        setDetector("error");
        showToast("Detector failed to load");
        throw error;
      });

    return modelPromise;
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------
  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setViewStatus("Camera API unavailable");
      return Promise.resolve(false);
    }
    // facingMode "environment" -> the world-facing camera (glasses / phone rear).
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(function(stream) {
        state.stream = stream;
        var video = byId("viewfinder");
        video.srcObject = stream;
        return video.play().then(function() {
          state.cameraReady = true;
          setViewStatus("Aim at a car, then Capture");
          return true;
        });
      })
      .catch(function(error) {
        console.warn("Camera error", error);
        setViewStatus("Camera blocked — allow the permission");
        return false;
      });
  }

  // ---------------------------------------------------------------------------
  // Capture + detect
  // ---------------------------------------------------------------------------
  function captureAndDetect() {
    if (state.phase !== "idle") return;
    if (!state.cameraReady) { showToast("Camera not ready"); return; }

    state.phase = "capturing";
    disableCapture(true);
    setViewStatus("Scanning…");

    ensureModel()
      .then(function(model) {
        var video = byId("viewfinder");
        var scale = CONFIG.captureWidth / video.videoWidth;
        var w = CONFIG.captureWidth;
        var h = Math.max(1, Math.round(video.videoHeight * scale));
        workCanvas.width = w;
        workCanvas.height = h;
        workCanvas.getContext("2d").drawImage(video, 0, 0, w, h);
        return model.detect(workCanvas);
      })
      .then(function(predictions) {
        var hit = null;
        for (var i = 0; i < predictions.length; i += 1) {
          var p = predictions[i];
          if (CONFIG.targets.indexOf(p.class) !== -1 && p.score >= CONFIG.minScore) {
            if (!hit || p.score > hit.score) hit = p;
          }
        }
        finishCapture(hit);
      })
      .catch(function(error) {
        console.warn("Detection failed", error);
        state.phase = "idle";
        disableCapture(false);
        setViewStatus("Detection failed — try again");
      });
  }

  function finishCapture(hit) {
    state.stats.shots += 1;
    if (hit) state.stats.caught += 1;
    saveStats();
    render();
    showResult(hit);
  }

  function showResult(hit) {
    state.phase = "result";
    var overlay = byId("result-overlay");
    overlay.classList.remove("success", "fail");

    if (hit) {
      overlay.classList.add("success");
      setText("result-emoji", "🚗");
      setText("result-title", "Captured!");
      setText("result-sub", capitalize(hit.class) + " · " + Math.round(hit.score * 100) + "%");
    } else {
      overlay.classList.add("fail");
      setText("result-emoji", "🔍");
      setText("result-title", "No car");
      setText("result-sub", "Get closer and try again");
    }

    overlay.classList.add("visible");
    clearTimeout(resultTimer);
    resultTimer = setTimeout(dismissResult, CONFIG.resultMs);
  }

  function dismissResult() {
    clearTimeout(resultTimer);
    var overlay = byId("result-overlay");
    if (overlay) overlay.classList.remove("visible");
    state.phase = "idle";
    disableCapture(false);
    setViewStatus("Aim at a car, then Capture");
    focusCapture();
  }

  function resetStats() {
    state.stats = { caught: 0, shots: 0 };
    saveStats();
    render();
    showToast("Score reset");
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  // ---------------------------------------------------------------------------
  // Input (D-pad + click)
  // ---------------------------------------------------------------------------
  function focusCapture() {
    var btn = byId("capture-btn");
    if (btn) btn.focus();
  }

  function moveFocus(direction) {
    var focusables = Array.prototype.slice.call(document.querySelectorAll(".focusable"));
    if (!focusables.length) return;
    var active = document.activeElement;
    var current = focusables.indexOf(active);
    var delta = (direction === "up" || direction === "left") ? -1 : 1;
    var next = current === -1 ? 0 : (current + delta + focusables.length) % focusables.length;
    focusables[next].focus();
  }

  function handleAction(action) {
    if (state.phase === "result") { dismissResult(); return; }
    if (action === "capture") captureAndDetect();
    if (action === "reset") resetStats();
  }

  function setupEvents() {
    document.addEventListener("click", function(event) {
      var target = event.target.closest("[data-action]");
      if (target) handleAction(target.dataset.action);
    });

    document.addEventListener("keydown", function(event) {
      switch (event.key) {
        case "ArrowUp":
          if (state.phase !== "result") moveFocus("up");
          event.preventDefault();
          break;
        case "ArrowDown":
          if (state.phase !== "result") moveFocus("down");
          event.preventDefault();
          break;
        case "ArrowLeft":
          if (state.phase !== "result") moveFocus("left");
          event.preventDefault();
          break;
        case "ArrowRight":
          if (state.phase !== "result") moveFocus("right");
          event.preventDefault();
          break;
        case "Enter":
          if (state.phase === "result") {
            dismissResult();
          } else if (document.activeElement && document.activeElement.classList.contains("focusable")) {
            document.activeElement.click();
          }
          event.preventDefault();
          break;
        case "Escape":
          if (state.phase === "result") dismissResult();
          event.preventDefault();
          break;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function hideLoadingScreen() {
    var loadingScreen = byId("loading-screen");
    if (!loadingScreen) return;
    loadingScreen.classList.add("hidden");
    window.setTimeout(function() { loadingScreen.remove(); }, 220);
  }

  // Drop any stale service worker / caches from a previous version of this app
  // (e.g. the old tic-tac-toe build) so the glasses WebView never serves stale
  // content. We do NOT register a SW by default.
  function clearOldCaches() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(function(regs) { regs.forEach(function(r) { r.unregister(); }); })
        .catch(function() {});
    }
    if ("caches" in window) {
      caches.keys()
        .then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); })
        .catch(function() {});
    }
  }

  function init() {
    loadStats();
    setupEvents();
    render();
    focusCapture();
    clearOldCaches();
    hideLoadingScreen();

    // Start camera, then pre-load + warm up the detector in the background so
    // the first Capture is instant.
    startCamera().then(function() {
      ensureModel().catch(function() { /* surfaced via detector pill */ });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
