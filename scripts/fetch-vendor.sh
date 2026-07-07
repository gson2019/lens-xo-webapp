#!/usr/bin/env bash
#
# Download TF.js + coco-ssd (lite_mobilenet_v2) into this app so the detector is
# served from the app's OWN origin instead of a CDN.
#
# Why: on the glasses the web-app WebView locks navigation to the launch domain
# and you want the game to work offline. Self-hosting the ~6MB model + runtime
# satisfies both. After running this, set  useLocalVendor: true  in app.js.
#
# Usage:  bash scripts/fetch-vendor.sh
# Requires: curl + python3 (only to parse the weight manifest).

set -euo pipefail
cd "$(dirname "$0")/.."

TFJS_VER="4.22.0"
COCO_VER="2.2.3"
# coco-ssd base "lite_mobilenet_v2" maps to this SavedModel dir:
MODEL_BASE_URL="https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2"
MODEL_DIR="models/coco-ssd-lite"

echo "==> vendor/ (runtime + model wrapper)"
mkdir -p vendor "$MODEL_DIR"
curl -fsSL "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${TFJS_VER}/dist/tf.min.js" -o vendor/tf.min.js
curl -fsSL "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@${COCO_VER}/dist/coco-ssd.min.js" -o vendor/coco-ssd.min.js

echo "==> ${MODEL_DIR}/ (model graph + weights)"
curl -fsSL "${MODEL_BASE_URL}/model.json" -o "${MODEL_DIR}/model.json"

# Pull every weight shard referenced by the manifest (count varies by version).
python3 - "$MODEL_DIR/model.json" <<'PY' | while read -r shard; do
import json, sys
m = json.load(open(sys.argv[1]))
for group in m.get("weightsManifest", []):
    for p in group.get("paths", []):
        print(p)
PY
  echo "    - $shard"
  curl -fsSL "${MODEL_BASE_URL}/${shard}" -o "${MODEL_DIR}/${shard}"
done

echo
echo "Done. Now set  useLocalVendor: true  in app.js (CONFIG)."
echo "Optionally register service-worker.js and add the vendor/model files to its"
echo "cache list so the game runs fully offline."
