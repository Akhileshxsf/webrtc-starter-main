socket.on('newOffer', async (offerData) => {
  if (!isPhone) {
    await createPeerConnection();
    await peerConnection.setRemoteDescription(offerData.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('newAnswer', { answer });
    startInference();
    startOverlay();
  }
});

socket.on('newAnswer', async (answerData) => {
  if (isPhone) {
    await peerConnection.setRemoteDescription(answerData.answer);
  }
});

socket.on('receivedIceCandidateFromSignalingServer', async (iceCandidate) => {
  if (peerConnection) {
    await peerConnection.addIceCandidate(iceCandidate);
  }
});

socket.on('activeDevices', (devices) => {
  activeDevices = new Set(devices);
  activeDevicesEl.innerHTML = '';
  activeDevices.forEach(device => {
    const div = document.createElement('div');
    div.textContent = device;
    activeDevicesEl.appendChild(div);
  });
});
