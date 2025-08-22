const isPhone = location.search.includes('phone');
const userName = isPhone ? 'phone' : `browser-${Math.random().toString(36).substr(2, 9)}`;
const password = 'x';

document.querySelector('#user-name').innerHTML = userName;

const socket = io.connect(location.origin, { auth: { userName, password } });

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');
const overlayCanvas = document.querySelector('#overlay');
const metricsEl = document.querySelector('#metrics');
const generateQrBtn = document.querySelector('#generate-qr');
const activeDevicesEl = document.querySelector('#active-devices');

let localStream, remoteStream, peerConnection, session, ws, isProcessing = false, frameId = 0, currentDetections = [];
let latencies = [], fpsCount = 0, benchStartTime, benchDuration;
let mode = new URLSearchParams(location.search).get('mode') || 'wasm';
let activeDevices = new Set();

const peerConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
};

function generateQR() {
  let baseUrl = location.origin;
  const qrEl = document.querySelector('#qr');
  qrEl.innerHTML = '';
  const publicBtn = document.createElement('button');
  publicBtn.textContent = 'Use Public URL (ngrok)';
  publicBtn.classList.add('btn', 'btn-secondary');
  publicBtn.addEventListener('click', async () => {
    const res = await fetch('/get-ngrok');
    baseUrl = await res.text();
    makeQR(baseUrl);
  });
  qrEl.appendChild(publicBtn);
  makeQR(baseUrl);
}
function makeQR(baseUrl) {
  const url = `${baseUrl}?phone=true`;
  new QRCode(document.querySelector('#qr'), url);
}

async function fetchUserMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true });
  localVideoEl.style.display = 'block';
  localVideoEl.srcObject = localStream;
}

async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(peerConfiguration);
  remoteStream = new MediaStream();
  remoteVideoEl.srcObject = remoteStream;

  if (localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }

  peerConnection.addEventListener('icecandidate', e => {
    if (e.candidate) socket.emit('sendIceCandidateToSignalingServer', { iceCandidate: e.candidate, iceUserName: userName });
  });

  peerConnection.addEventListener('track', e => {
    remoteStream.addTrack(e.track);
    remoteVideoEl.srcObject = remoteStream;
  });
}

async function call() {
  await createPeerConnection();
  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('newOffer', { offer });
}

// ========= Inference + Overlay =========
async function startInference() {
  if (mode === 'wasm') {
    session = await ort.InferenceSession.create('./models/ssd_mobilenet_v1_10.onnx', { executionProviders: ['wasm'], numThreads: 1 });
  } else {
    ws = new WebSocket('ws://localhost:8000');
  }
  setInterval(processFrame, 100); // ~10 FPS
}

async function processFrame() {
  if (isProcessing || !peerConnection) return;
  isProcessing = true;
  const fId = frameId++;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  canvas.getContext('2d').drawImage(remoteVideoEl, 0, 0, 320, 240);
  if (mode === 'wasm') {
    const detections = await runWasmInference(canvas);
    updateOverlay({ frame_id: fId, detections });
  } else {
    const image = canvas.toDataURL('image/jpeg', 0.5);
    ws.send(JSON.stringify({ frame_id: fId, image }));
  }
  isProcessing = false;
  fpsCount++;
}

async function runWasmInference(canvas) {
  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = inputCanvas.height = 300;
  inputCanvas.getContext('2d').drawImage(canvas, 0, 0, 300, 300);
  const inputData = inputCanvas.getContext('2d').getImageData(0, 0, 300, 300).data;
  const rgbData = new Float32Array(3 * 300 * 300);
  for (let i = 0; i < 300 * 300; i++) {
    rgbData[i] = inputData[i * 4] / 255;
    rgbData[i + 300 * 300] = inputData[i * 4 + 1] / 255;
    rgbData[i + 2 * 300 * 300] = inputData[i * 4 + 2] / 255;
  }
  const tensor = new ort.Tensor('float32', rgbData, [1, 3, 300, 300]);
  const outputs = await session.run({ image: tensor });
  const num = outputs['num_detections'].data[0];
  const boxes = outputs['detection_boxes'].data;
  const scores = outputs['detection_scores'].data;
  const classes = outputs['detection_classes'].data;
  const labels = ['person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'];
  const detections = [];
  for (let i = 0; i < num; i++) {
    if (scores[i] > 0.5) detections.push({ label: labels[classes[i] - 1], score: scores[i], ymin: boxes[i * 4], xmin: boxes[i * 4 + 1], ymax: boxes[i * 4 + 2], xmax: boxes[i * 4 + 3] });
  }
  return detections;
}

function startOverlay() {
  function draw() {
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCanvas.width = remoteVideoEl.videoWidth;
    overlayCanvas.height = remoteVideoEl.videoHeight;
    ctx.lineWidth = 2;
    currentDetections.forEach(d => {
      ctx.strokeStyle = 'red';
      ctx.strokeRect(d.xmin * overlayCanvas.width, d.ymin * overlayCanvas.height,
        (d.xmax - d.xmin) * overlayCanvas.width, (d.ymax - d.ymin) * overlayCanvas.height);
      ctx.fillStyle = 'white';
      ctx.fillText(`${d.label} (${(d.score * 100).toFixed(1)}%)`,
        d.xmin * overlayCanvas.width, d.ymin * overlayCanvas.height - 5);
    });
    requestAnimationFrame(draw);
  }
  draw();
}

function updateOverlay(json) {
  currentDetections = json.detections;
}

// ========= Lifecycle =========
if (isPhone) {
  generateQrBtn.style.display = "none";
  socket.emit('join', userName);
  fetchUserMedia().then(call);
} else {
  socket.emit('join', userName);
  generateQrBtn.addEventListener('click', generateQR);
}

document.querySelector('#hangup').addEventListener('click', () => {
  if (peerConnection) peerConnection.close();
  if (ws) ws.close();
  window.location.reload();
});
