# Car Hunter — Meta Ray-Ban Display web app

Aim the glasses at a car, press **Capture**, and on-device object detection
(TensorFlow.js **coco-ssd**) scores the catch. Runs **entirely in the glasses
web app** — no companion phone app, no backend.

```
Capture (D-pad)  →  getUserMedia grabs a frame  →  coco-ssd detects "car"
                 →  ✅ Captured! / 🔍 No car  →  score updates
```

## Files

| File | Role |
|------|------|
| `index.html` | Single-screen game UI (viewfinder, capture/reset, result overlay) |
| `app.js` | Camera, lazy model load + warmup, capture→detect→score, D-pad input |
| `styles.css` | 600×600 additive-display styling (black = transparent) |
| `service-worker.js` | Optional offline cache (not registered by default) |
| `scripts/fetch-vendor.sh` | Download TF.js + model to self-host on-device |

## Test in a desktop browser (fastest loop)

```bash
python3 -m http.server 3000    # localhost is a secure context, so the webcam works
# open http://localhost:3000  → allow camera → arrow keys = D-pad, Enter = select
```

The default config loads TF.js + coco-ssd from a CDN, so it just works in the browser.

## Deploy + run on the glasses

1. **Enable the web-app camera** (userdebug/eng build — it's gated off by default):
   ```bash
   adb shell setprop persist.sys.smartglass.web_on_hn.gating_get_user_media_video_api true
   ```
   Reboot / relaunch the web app, then accept the on-device consent dialog.
   (Production needs the `web_on_hn.gating_get_user_media_video_api` MobileConfig ramped.)
2. Host this folder at a public **HTTPS** URL (Vercel config included).
3. Add it to the glasses: Meta AI app → Devices → Display Glasses → App connections
   → Web apps → Add (or scan a QR deep link).

## Self-host the detector (recommended for on-device)

The glasses WebView locks navigation to the launch domain and you want offline
support, so serve the ~6MB model from this app instead of a CDN:

```bash
bash scripts/fetch-vendor.sh      # downloads vendor/ + models/coco-ssd-lite/
```
Then set `useLocalVendor: true` in `app.js` (`CONFIG`). Optionally register
`service-worker.js` and add the vendor/model files to its cache list for full offline.

## Tuning (`CONFIG` in `app.js`)

| Knob | Default | Notes |
|------|---------|-------|
| `targets` | `["car"]` | Widen to `["car","truck","bus","motorcycle"]` for a "vehicle" game |
| `minScore` | `0.6` | Confidence threshold |
| `captureWidth` | `320` | Downscale before inference — lower = faster/less memory |
| `modelBase` | `lite_mobilenet_v2` | Smallest coco-ssd backbone; best fit for glasses |

## Notes / limits

- **Single-shot** inference on Capture — no continuous detection loop (battery + the
  platform's <128MB memory / <500KB initial-JS budgets). The model is lazy-loaded
  after the shell shows and warmed up once.
- No AR bounding-box overlay: the glasses camera FOV isn't calibrated to the display,
  so boxes wouldn't line up with the real world. Result is shown as a card.
- coco-ssd + WebGL sits near the 128MB memory line — pressure-test on device; if it
  OOMs, drop `captureWidth` or switch to a MediaPipe EfficientDet-Lite0 model.
