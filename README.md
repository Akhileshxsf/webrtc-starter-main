Real-time WebRTC VLM Multi-Object Detection (Phone → Browser → Inference → Overlay)
Overview

This project demonstrates real-time multi-object detection on live video streamed from a phone using WebRTC. The phone’s camera feed is sent to the browser, where bounding boxes and labels from an object detection model are overlaid in near real-time.

It supports two modes:

1.Server Mode: inference runs on the backend (CPU with ONNX Runtime).

2.WASM Mode: inference runs directly in the browser using onnxruntime-web or tfjs-wasm.

Deliverables

Git repo with frontend, optional server, Dockerfile(s), and docker-compose.yml

One-command start with ./start.sh

metrics.json with latency, FPS, and bandwidth numbers

A 1-minute Loom demo video

Design appendix covering choices, low-resource mode, and backpressure strategy

Quick Start

Clone the repository
git clone <repo-url>
cd realtime-webrtc-vlm

Run in WASM mode (default, low-resource)
./start.sh
or
MODE=wasm ./start.sh

Run in Server mode
npm start

Connect your phone

Open http://you-local-ip-address-t:3000
 on your laptop

Scan the QR code displayed on the page with your phone

Allow camera access → You should see the phone stream with real-time detection overlays

If your phone cannot connect locally, use ngrok:
./start.sh --ngrok
Copy the public URL into your phone browser

Benchmarks

Run a 30s benchmark:
./bench/run_bench.sh --duration 30 --mode wasm

This produces a file metrics.json. Example:
{
"mode": "wasm",
"duration_seconds": 30,
"median_latency_ms": 85,
"p95_latency_ms": 138,
"fps": 12,
"uplink_kbps": 540,
"downlink_kbps": 610
}

Troubleshooting

Phone won’t connect → ensure both devices are on the same Wi-Fi or use ngrok

Overlays misaligned → check capture_ts timestamps in ms

High CPU usage → downscale input to 320x240 or use WASM mode

Laggy inference → drop old frames and only process the latest frame

Design Choices & Tradeoffs

Low-resource mode: WASM inference with MobileNet-SSD at 320x240, targeting 10–15 FPS

Backpressure policy: fixed queue, drop stale frames under load

Architecture: WebRTC for video stream, WebSockets for detection results

Fairness: phone only needs a browser (Chrome on Android, Safari on iOS)

Next Improvements

Upgrade to YOLOv8n quantized for better accuracy at similar FPS

Add GPU inference mode for high-performance systems

Implement adaptive FPS control based on network and CPU conditions
