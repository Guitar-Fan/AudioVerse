// --- DAW Playback and Transport Logic ---

playBtn.onclick = () => { playAll(); };
pauseBtn.onclick = () => { stopAll(); };
addTrackBtn.onclick = () => {
  tracks.push(createTrack());
  render();
};

function updatePlayhead(t) {
  playheadTime = t;
  renderTimeline();
}

function playAll() {
  initAudioContext();
  stopAll();
  let playStartAudioCtx = audioCtx.currentTime;
  let playStartTime = playheadTime;
  playing = true;

  // Prepare play sources array
  window._playSources = [];

  // Determine which tracks to play (solo logic)
  let soloTracks = tracks.filter(t => t.solo);
  let playTracks = soloTracks.length ? soloTracks : tracks.filter(t => !t.muted);

  // Start all clips with proper audio routing
  playTracks.forEach((track, trackIdx) => {
    const trackGain = getTrackGainNode(trackIdx);
    trackGain.gain.value = track.volume;

    // Ensure gain node is connected to analyser/master
    if (!trackGain._connected) {
      trackGain.disconnect();
      trackGain.connect(analyserNode);
      trackGain._connected = true;
    }

    track.clips.forEach(clip => {
      if (!clip.audioBuffer) return;
      // Only play clips that overlap with playheadTime
      if (clip.startTime + clip.duration <= playheadTime) return;

      let source = audioCtx.createBufferSource();
      source.buffer = clip.audioBuffer;

      // Routing: source -> (optional filter) -> trackGain
      let lastNode = source;
      if (filterNodes.has(trackIdx)) {
        lastNode.connect(filterNodes.get(trackIdx));
        lastNode = filterNodes.get(trackIdx);
      }
      lastNode.connect(trackGain);

      // Calculate when to start and what offset/duration to play
      let startAt = Math.max(clip.startTime, playheadTime);
      let offset = clip.offset + Math.max(0, playheadTime - clip.startTime);
      let duration = Math.min(clip.duration - (offset - clip.offset), clip.audioBuffer.duration - offset);

      // Schedule playback
      if (clip.startTime >= playheadTime) {
        // Starts in the future
        source.start(audioCtx.currentTime + (clip.startTime - playheadTime), clip.offset, clip.duration);
      } else if (clip.startTime + clip.duration > playheadTime) {
        // Already started, play from offset
        source.start(audioCtx.currentTime, offset, duration);
      }

      window._playSources.push(source);
    });
  });

  pauseBtn.disabled = false;
  playBtn.disabled = true;

  function step() {
    let elapsed = audioCtx.currentTime - playStartAudioCtx;
    let t = playStartTime + elapsed;
    updatePlayhead(t);
    if (t > MAX_TIME) { stopAll(); return; }
    if (playing) playRequestId = requestAnimationFrame(step);
  }
  playRequestId = requestAnimationFrame(step);

  if (metronomeEnabled) startMetronome();
  setTimeout(stopAll, (MAX_TIME - playheadTime) * 1000);
}

function stopAll() {
  if (window._playSources) {
    window._playSources.forEach(src => { try { src.stop(); } catch{} });
    window._playSources = [];
  }
  playing = false;
  if (playRequestId) cancelAnimationFrame(playRequestId);
  pauseBtn.disabled = true;
  playBtn.disabled = false;
  stopMetronome();
}

// Ensure metronome functions exist to avoid breaking playback
if (typeof startMetronome !== "function") {
  function startMetronome() {}
}
if (typeof stopMetronome !== "function") {
  function stopMetronome() {}
}