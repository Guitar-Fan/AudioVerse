// --- Audio Editor Functions ---

/**
 * Opens the audio editor view for the specified clip
 * @param {number} trackIndex - Index of the track containing the clip
 * @param {number} clipIndex - Index of the clip within the track
 * @param {Object} clip - The clip object to edit
 */
function openAudioEditor(trackIndex, clipIndex, clip) {
  if (!clip || !clip.audioBuffer) {
    console.error('Cannot open editor: clip or audioBuffer missing');
    return;
  }

  // Store current editing context
  currentEditingClip = clip;
  currentEditingTrackIndex = trackIndex;
  currentEditingClipIndex = clipIndex;

  // Update clip information in editor header
  editorClipName.textContent = clip.name;
  editorClipDetails.textContent = `Duration: ${clip.duration.toFixed(2)}s | Sample Rate: ${clip.audioBuffer.sampleRate}Hz | Channels: ${clip.audioBuffer.numberOfChannels}`;

  // Show the audio editor view
  showAudioEditorView();

  // Initialize the editor with the clip data
  initializeAudioEditor();

  console.log('Opened audio editor for clip:', clip.name);
}

/**
 * Shows the audio editor view and hides other views
 */
function showAudioEditorView() {
  currentView = 'editor';
  
  // Hide other windows
  arrangementWindow.classList.add('hidden');
  arrangementWindow.classList.remove('active');
  mixerWindow.classList.add('hidden');
  mixerWindow.classList.remove('active');
  
  // Show editor window
  editorWindow.classList.remove('hidden');
  editorWindow.classList.add('active');
  
  // Update view buttons
  arrangeViewBtn.classList.add('bg-gray-600', 'text-white');
  arrangeViewBtn.classList.remove('bg-orange-500', 'text-black');
  mixerViewBtn.classList.add('bg-gray-600', 'text-white');
  mixerViewBtn.classList.remove('bg-orange-500', 'text-black');
  editorViewBtn.classList.add('bg-orange-500', 'text-black');
  editorViewBtn.classList.remove('bg-gray-600', 'text-white');
  
  // Show the editor view button if it was hidden
  editorViewBtn.classList.remove('hidden');
}

/**
 * Returns to the arrangement view from the audio editor
 */
function returnToArrangementView() {
  // Apply any pending changes to the clip
  applyEditorChanges();
  
  // Clear editor state
  currentEditingClip = null;
  currentEditingTrackIndex = -1;
  currentEditingClipIndex = -1;
  
  // Show arrangement view
  showArrangementView();
  
  // Hide the editor view button
  editorViewBtn.classList.add('hidden');
  
  // Re-render to reflect any changes
  render();
  
  console.log('Returned to arrangement view');
}

/**
 * Initializes the audio editor with the current clip's data
 */
function initializeAudioEditor() {
  if (!currentEditingClip || !currentEditingClip.audioBuffer) return;

  const clip = currentEditingClip;
  const buffer = clip.audioBuffer;

  // Reset editor state
  editorZoomLevel = 1;
  editorPixelsPerSecond = 200;
  editorSelectionStart = 0;
  editorSelectionEnd = 0;
  editorPlayheadPosition = 0;

  // Update clip property inputs
  document.getElementById('editorClipStart').value = clip.startTime.toFixed(2);
  document.getElementById('editorClipLength').value = clip.duration.toFixed(2);
  document.getElementById('editorClipOffset').value = clip.offset.toFixed(2);

  // Draw the waveform
  drawEditorWaveform();

  // Draw the timeline
  drawEditorTimeline();

  // Set up canvas event listeners for selection
  setupEditorCanvasEvents();

  console.log('Initialized audio editor for clip:', clip.name);
}

/**
 * Draws the detailed waveform in the editor canvas
 */
function drawEditorWaveform() {
  if (!currentEditingClip || !currentEditingClip.audioBuffer) return;

  const canvas = editorWaveformCanvas;
  const ctx = canvas.getContext('2d');
  const buffer = currentEditingClip.audioBuffer;
  
  // Set canvas size to match container
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

 
  // Draw background
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get audio data
  const channelData = buffer.getChannelData(0);
  const samplesPerPixel = Math.max(1, Math.floor(channelData.length / canvas.width));

  // Draw waveform
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x < canvas.width; x++) {
    const startSample = Math.floor(x * samplesPerPixel);
    const endSample = Math.min(startSample + samplesPerPixel, channelData.length);
    
    let min = 1.0;
    let max = -1.0;
    
    for (let i = startSample; i < endSample; i++) {
      const sample = channelData[i];
      min = Math.min(min, sample);
      max = Math.max(max, sample);
    }
    
    const y1 = ((1 - max) / 2) * canvas.height;
    const y2 = ((1 - min) / 2) * canvas.height;
    
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
  
  ctx.stroke();

  // Draw center line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

/**
 * Draws the timeline below the waveform
 */
function drawEditorTimeline() {
  if (!currentEditingClip) return;

  const timeline = editorTimeline;
  timeline.innerHTML = '';
  
  const duration = currentEditingClip.duration;
  const timelineWidth = timeline.clientWidth;
  const pixelsPerSecond = timelineWidth / duration;
  
  // Create time markers
  const interval = duration > 10 ? 1 : duration > 5 ? 0.5 : 0.1;
  
  for (let time = 0; time <= duration; time += interval) {
    const x = (time / duration) * timelineWidth;
    
    const marker = document.createElement('div');
    marker.className = 'timeline-marker';
    marker.style.position = 'absolute';
    marker.style.left = x + 'px';
    marker.style.top = '0';
    marker.style.width = '1px';
    marker.style.height = '100%';
    marker.style.backgroundColor = '#6b7280';
    
    const label = document.createElement('span');
    label.className = 'timeline-label';
    label.style.position = 'absolute';
    label.style.left = (x + 2) + 'px';
    label.style.top = '2px';
    label.style.fontSize = '10px';
    label.style.color = '#9ca3af';
    label.textContent = time.toFixed(1) + 's';
    
    timeline.appendChild(marker);
    timeline.appendChild(label);
  }
}

/**
 * Sets up mouse event listeners for the editor canvas
 */
function setupEditorCanvasEvents() {
  const canvas = editorWaveformCanvas;
  let isMouseDown = false;
  let startX = 0;

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    editorIsSelecting = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    
    // Convert pixel position to time
    const duration = currentEditingClip.duration;
    const timePosition = (startX / canvas.width) * duration;
    
    editorSelectionStart = timePosition;
    editorSelectionEnd = timePosition;
    
    updateEditorSelection();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !editorIsSelecting) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    
    // Convert pixel position to time
    const duration = currentEditingClip.duration;
    const timePosition = (currentX / canvas.width) * duration;
    
    editorSelectionEnd = timePosition;
    updateEditorSelection();
  });

  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    editorIsSelecting = false;
    
    // Ensure selection start is less than end
    if (editorSelectionStart > editorSelectionEnd) {
      const temp = editorSelectionStart;
      editorSelectionStart = editorSelectionEnd;
      editorSelectionEnd = temp;
    }
  });

  // Click to set playhead position
  canvas.addEventListener('click', (e) => {
    if (editorIsSelecting) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Convert pixel position to time
    const duration = currentEditingClip.duration;
    editorPlayheadPosition = (clickX / canvas.width) * duration;
    
    updateEditorPlayhead();
  });
}

/**
 * Updates the visual selection overlay in the editor
 */
function updateEditorSelection() {
  if (!currentEditingClip) return;
  
  const canvas = editorWaveformCanvas;
  const selection = editorSelection;
  const duration = currentEditingClip.duration;
  
  if (Math.abs(editorSelectionEnd - editorSelectionStart) > 0.001) {
    const startPercent = (editorSelectionStart / duration) * 100;
    const widthPercent = ((editorSelectionEnd - editorSelectionStart) / duration) * 100;
    
    selection.style.left = startPercent + '%';
    selection.style.width = widthPercent + '%';
    selection.classList.remove('hidden');
  } else {
    selection.classList.add('hidden');
  }
}

/**
 * Updates the visual playhead position in the editor
 */
function updateEditorPlayhead() {
  if (!currentEditingClip) return;
  
  const playhead = editorPlayhead;
  const duration = currentEditingClip.duration;
  const positionPercent = (editorPlayheadPosition / duration) * 100;
  
  playhead.style.left = positionPercent + '%';
  playhead.classList.remove('hidden');
}

/**
 * Applies any changes made in the editor back to the original clip
 */
function applyEditorChanges() {
  if (!currentEditingClip || currentEditingTrackIndex === -1 || currentEditingClipIndex === -1) return;

  // Get updated values from input fields
  const newStart = parseFloat(document.getElementById('editorClipStart').value) || currentEditingClip.startTime;
  const newLength = parseFloat(document.getElementById('editorClipLength').value) || currentEditingClip.duration;
  const newOffset = parseFloat(document.getElementById('editorClipOffset').value) || currentEditingClip.offset;

  // Apply changes to the clip
  currentEditingClip.startTime = newStart;
  currentEditingClip.duration = Math.max(0.1, newLength);
  currentEditingClip.offset = Math.max(0, newOffset);

  // Save state for undo
  saveState();

  console.log('Applied editor changes to clip:', currentEditingClip.name);
}

// --- Audio Editor Event Listeners ---

// Back button to return to arrangement view
if (backButton) {
  backButton.onclick = returnToArrangementView;
}

// Editor view button
if (editorViewBtn) {
  editorViewBtn.onclick = () => {
    if (currentEditingClip) {
      showAudioEditorView();
    }
  };
}

// Editor tool buttons
document.addEventListener('DOMContentLoaded', () => {
  // Zoom controls
  const editorZoomFit = document.getElementById('editorZoomFit');
  const editorZoomIn = document.getElementById('editorZoomIn');
  const editorZoomOut = document.getElementById('editorZoomOut');
  
  if (editorZoomFit) {
    editorZoomFit.onclick = () => {
      editorZoomLevel = 1;
      drawEditorWaveform();
    };
  }
  
  if (editorZoomIn) {
    editorZoomIn.onclick = () => {
      editorZoomLevel = Math.min(editorZoomLevel * 1.5, 10);
      drawEditorWaveform();
    };
  }
  
  if (editorZoomOut) {
    editorZoomOut.onclick = () => {
      editorZoomLevel = Math.max(editorZoomLevel / 1.5, 0.1);
      drawEditorWaveform();
    };
  }

  // Processing buttons
  const editorNormalize = document.getElementById('editorNormalize');
  const editorReverse = document.getElementById('editorReverse');
  const editorFadeIn = document.getElementById('editorFadeIn');
  const editorFadeOut = document.getElementById('editorFadeOut');
  
  if (editorNormalize) {
    editorNormalize.onclick = () => {
      if (currentEditingClip) {
        normalizeClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }
  
  if (editorReverse) {
    editorReverse.onclick = () => {
      if (currentEditingClip) {
        reverseClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }
  
  if (editorFadeIn) {
    editorFadeIn.onclick = () => {
      if (currentEditingClip) {
        fadeInClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }
  
  if (editorFadeOut) {
    editorFadeOut.onclick = () => {
      if (currentEditingClip) {
        fadeOutClip(currentEditingTrackIndex, currentEditingClipIndex);
        drawEditorWaveform();
      }
    };
  }

  // Selection tools
  const editorSelectAll = document.getElementById('editorSelectAll');
  const editorClearSelection = document.getElementById('editorClearSelection');
  
  if (editorSelectAll) {
    editorSelectAll.onclick = () => {
      if (currentEditingClip) {
        editorSelectionStart = 0;
        editorSelectionEnd = currentEditingClip.duration;
        updateEditorSelection();
      }
    };
  }
  
  if (editorClearSelection) {
    editorClearSelection.onclick = () => {
      editorSelectionStart = 0;
      editorSelectionEnd = 0;
      updateEditorSelection();
    };
  }

  // Property input change handlers
  const clipStartInput = document.getElementById('editorClipStart');
  const clipLengthInput = document.getElementById('editorClipLength');
  const clipOffsetInput = document.getElementById('editorClipOffset');
  
  if (clipStartInput) {
    clipStartInput.onchange = () => applyEditorChanges();
  }
  
  if (clipLengthInput) {
    clipLengthInput.onchange = () => applyEditorChanges();
  }
  
  if (clipOffsetInput) {
    clipOffsetInput.onchange = () => applyEditorChanges();
  }
});

// Handle window resize for the editor canvas
window.addEventListener('resize', () => {
  if (currentView === 'editor' && currentEditingClip) {
    setTimeout(() => {
      drawEditorWaveform();
      drawEditorTimeline();
    }, 100);