const express = require('express');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const ngrok = require('ngrok');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Add CORS headers for cross-origin isolation
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

const server = https.createServer({
  key: fs.readFileSync('cert.key'),
  cert: fs.readFileSync('cert.crt')
}, app);

const io = new Server(server, {
  cors: { origin: '*' }
});

let currentOffer = null;
let activeDevices = new Set();

io.on('connection', (socket) => {
  const userName = socket.handshake.auth.userName;
  console.log(`User ${userName} connected`);

  activeDevices.add(userName);
  io.emit('activeDevices', Array.from(activeDevices));

  socket.on('join', (userName) => {
    socket.join('global');
    activeDevices.add(userName);
    io.emit('activeDevices', Array.from(activeDevices));
    if (currentOffer) {
      socket.emit('newOffer', currentOffer);
    }
  });

  socket.on('newOffer', (data) => {
    const { offer } = data;
    currentOffer = { offer };
    io.to('global').emit('newOffer', currentOffer);
    console.log('Broadcasting offer to all clients');
  });

  socket.on('newAnswer', (data) => {
    const { answer } = data;
    io.emit('newAnswer', { answer });
    currentOffer = null;
  });

  socket.on('sendIceCandidateToSignalingServer', (data) => {
    const { iceCandidate, iceUserName, didIOffer } = data;
    io.emit('receivedIceCandidateFromSignalingServer', iceCandidate);
  });

  socket.on('disconnect', () => {
    console.log(`User ${userName} disconnected`);
    activeDevices.delete(userName);
    io.emit('activeDevices', Array.from(activeDevices));
  });
});

app.get('/get-ngrok', async (req, res) => {
  try {
    const url = await ngrok.connect({ addr: 8181, authtoken: process.env.NGROK_AUTH_TOKEN });
    res.send(url);
  } catch (error) {
    console.error('Ngrok error:', error);
    res.status(500).send('Failed to start ngrok');
  }
});

app.post('/save-metrics', (req, res) => {
  try {
    fs.writeFileSync('metrics.json', JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
  } catch (error) {
    console.error('Error saving metrics:', error);
    res.status(500).send('Failed to save metrics');
  }
});

server.listen(8181, '10.10.48.80', () => {
  console.log('Server running on https://10.10.48.80:8181');
});