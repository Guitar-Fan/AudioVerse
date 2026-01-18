// ============================================
// TUTORIAL SYSTEM - "RIFF" CHARACTER GUIDE
// ============================================

let currentTutorialStep = 0;
let tutorialActive = false;
let tutorialHighlights = [];
let tutorialArrows = [];
let tutorialWaitingForAction = false;
let tutorialCompletedActions = new Set();

const tutorialSteps = [
  {
    text: "Hey there! I'm Riff 🎸, your guide to AudioVerse! This is a full-featured DAW right in your browser. Ready to rock? Click 'Next' to begin!",
    action: null,
    highlight: null
  },
  {
    text: "First, let's check out the transport controls. See that green PLAY button? That's how you start playback. Press it anytime to hear your tracks!",
    action: null,
    highlight: '#playBtn',
    arrow: { target: '#playBtn', position: 'top' }
  },
  {
    text: "The STOP button halts playback and resets to the beginning. The PAUSE button keeps your position.",
    action: null,
    highlight: '#stopBtn',
    arrow: { target: '#stopBtn', position: 'top' }
  },
  {
    text: "Perfect! Now let's explore the views. Click on 'Mixer View' to see the mixing console.",
    action: 'switch-to-mixer',
    highlight: '#mixerViewBtn',
    arrow: { target: '#mixerViewBtn', position: 'top' }
  },
  {
    text: "Awesome! This is the mixer view where you control volume, pan, and effects for each track. See the faders and pan knobs? Now click 'Arrangement View' to go back.",
    action: 'switch-to-arrangement',
    highlight: '#arrangeViewBtn',
    arrow: { target: '#arrangeViewBtn', position: 'top' }
  },
  {
    text: "Great! The 'Add Track' button creates new audio tracks. Each track can hold multiple audio clips.",
    action: null,
    highlight: '#addTrackBtn',
    arrow: { target: '#addTrackBtn', position: 'left' }
  },
  {
    text: "See the ARM button (⊙) in track headers? It prepares a track for recording. Armed tracks are highlighted in orange!",
    action: null,
    highlight: '.arm-btn',
    arrow: { target: '.arm-btn', position: 'left' }
  },
  {
    text: "The RECORD button starts capturing audio to armed tracks. When you record, you'll see a live waveform visualization showing your input in real-time!",
    action: null,
    highlight: '#recordBtn',
    arrow: { target: '#recordBtn', position: 'top' }
  },
  {
    text: "The SOLO (S) and MUTE (M) buttons let you isolate or silence individual tracks. Perfect for focusing on specific parts of your mix!",
    action: null,
    highlight: '.solo-btn',
    arrow: { target: '.solo-btn', position: 'left' }
  },
  {
    text: "Clips can be dragged to move them in time. They automatically snap to measure markers for perfect timing!",
    action: null,
    highlight: '.track',
    arrow: { target: '.track', position: 'top' }
  },
  {
    text: "Let's check out effects! Click the 'FX Plugins' view button to see the FX browser.",
    action: 'switch-to-fx',
    highlight: '#fxViewBtn',
    arrow: { target: '#fxViewBtn', position: 'top' }
  },
  {
    text: "This is the FX browser! Here you can add reverb, delay, EQ, compressor, and many more effects to your tracks. Click 'Arrangement View' to continue.",
    action: 'switch-to-arrangement-2',
    highlight: '#arrangeViewBtn',
    arrow: { target: '#arrangeViewBtn', position: 'top' }
  },
  {
    text: "Let's explore tempo and timing. See the BPM control? You can change the tempo from 20 to 300 BPM. The metronome button (🎵) plays a click track while recording.",
    action: null,
    highlight: '#bpm',
    arrow: { target: '#bpm', position: 'bottom' }
  },
  {
    text: "The time signature controls let you work in different time signatures like 4/4, 3/4, 6/8, and more. Perfect for any musical style!",
    action: null,
    highlight: '#timeSigNum',
    arrow: { target: '#timeSigNum', position: 'bottom' }
  },
  {
    text: "Want to zoom in for precise editing? Use the zoom controls at the bottom right. Zoom In (+), Zoom Out (-), and Zoom to Fit are your friends!",
    action: null,
    highlight: '.zoom-controls',
    arrow: { target: '.zoom-controls', position: 'top' }
  },
  {
    text: "You can upload audio files using this button! Import your own tracks and samples to build your project.",
    action: null,
    highlight: 'label.upload-btn',
    arrow: { target: 'label.upload-btn', position: 'left' }
  },
  {
    text: "Each track has volume faders in the track header. Drag them up or down to adjust the track's level in the mix.",
    action: null,
    highlight: '.track-header',
    arrow: { target: '.track-header', position: 'left' }
  },
  {
    text: "Double-click any audio clip to open the Audio Editor! There you can fine-tune pitch, apply volume automation curves, and edit waveforms precisely.",
    action: null,
    highlight: null,
    arrow: null
  },
  {
    text: "Need to go back in time? Use UNDO (Ctrl+Z) and REDO (Ctrl+Y) buttons in the toolbar. You can also save and load your entire project!",
    action: null,
    highlight: '#undoBtn',
    arrow: { target: '#undoBtn', position: 'bottom' }
  },
  {
    text: "The timeline shows measures and beats. You can click anywhere on it to jump to that position. Perfect for quick navigation during editing!",
    action: null,
    highlight: '#timeline',
    arrow: { target: '#timeline', position: 'bottom' }
  },
  {
    text: "The grid shows measure lines and beat subdivisions. This helps you place clips precisely and maintain perfect timing in your compositions.",
    action: null,
    highlight: '.timeline',
    arrow: { target: '.timeline', position: 'bottom' }
  },
  {
    text: "That's the grand tour! 🎉 You now know the basics of AudioVerse. Remember: Record, Edit, Mix, and Create amazing music right in your browser!",
    action: null,
    highlight: null
  },
  {
    text: "You're all set! Keep exploring and making music. If you need help, just click 'Meet Riff' again. Now go create something awesome! 🎸🎵",
    action: 'complete',
    highlight: null
  }
];

function startTutorial() {
  tutorialActive = true;
  currentTutorialStep = 0;
  tutorialCompletedActions.clear();
  const overlay = document.getElementById('tutorial-overlay');
  const launchBtn = document.getElementById('tutorial-btn');
  
  overlay.classList.add('active');
  launchBtn.style.display = 'none';
  
  showTutorialStep();
}

function showTutorialStep() {
  if (currentTutorialStep >= tutorialSteps.length) {
    endTutorial();
    return;
  }
  
  const step = tutorialSteps[currentTutorialStep];
  const tutorialText = document.getElementById('tutorial-text');
  const tutorialNext = document.getElementById('tutorial-next');
  const overlay = document.getElementById('tutorial-overlay');
  
  // Clear previous highlights and arrows
  clearTutorialHighlights();
  
  // Update text
  tutorialText.textContent = step.text;
  
  // Handle highlights
  if (step.highlight) {
    const elements = document.querySelectorAll(step.highlight);
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const highlight = document.createElement('div');
      highlight.className = 'tutorial-highlight';
      highlight.style.left = rect.left + 'px';
      highlight.style.top = rect.top + 'px';
      highlight.style.width = rect.width + 'px';
      highlight.style.height = rect.height + 'px';
      document.body.appendChild(highlight);
      tutorialHighlights.push(highlight);
    });
  }
  
  // Handle arrows
  if (step.arrow) {
    const target = document.querySelector(step.arrow.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      const arrow = document.createElement('div');
      arrow.className = 'tutorial-arrow';
      arrow.innerHTML = '👉';
      arrow.style.fontSize = '30px';
      
      // Position arrow based on direction
      switch (step.arrow.position) {
        case 'top':
          arrow.style.left = (rect.left + rect.width / 2 - 20) + 'px';
          arrow.style.top = (rect.top - 50) + 'px';
          arrow.innerHTML = '👇';
          break;
        case 'bottom':
          arrow.style.left = (rect.left + rect.width / 2 - 20) + 'px';
          arrow.style.top = (rect.bottom + 10) + 'px';
          arrow.innerHTML = '👆';
          break;
        case 'left':
          arrow.style.left = (rect.left - 50) + 'px';
          arrow.style.top = (rect.top + rect.height / 2 - 20) + 'px';
          arrow.innerHTML = '👉';
          break;
        case 'right':
          arrow.style.left = (rect.right + 10) + 'px';
          arrow.style.top = (rect.top + rect.height / 2 - 20) + 'px';
          arrow.innerHTML = '👈';
          break;
      }
      
      document.body.appendChild(arrow);
      tutorialArrows.push(arrow);
    }
  }
  
  // Handle action requirements
  if (step.action && step.action !== 'complete') {
    tutorialWaitingForAction = true;
    tutorialNext.textContent = 'Waiting...';
    tutorialNext.disabled = true;
    tutorialNext.style.opacity = '0.5';
    overlay.classList.add('waiting-for-action');
  } else {
    tutorialWaitingForAction = false;
    tutorialNext.textContent = 'Next';
    tutorialNext.disabled = false;
    tutorialNext.style.opacity = '1';
    overlay.classList.remove('waiting-for-action');
  }
}

function clearTutorialHighlights() {
  tutorialHighlights.forEach(h => h.remove());
  tutorialArrows.forEach(a => a.remove());
  tutorialHighlights = [];
  tutorialArrows = [];
}

function nextTutorialStep() {
  if (tutorialWaitingForAction) {
    // Shake dialogue to indicate waiting
    const dialogue = document.getElementById('tutorial-dialogue');
    dialogue.style.animation = 'none';
    setTimeout(() => {
      dialogue.style.animation = 'dialogue-shake 0.5s ease-in-out';
    }, 10);
    return;
  }
  
  currentTutorialStep++;
  showTutorialStep();
}

function skipTutorial() {
  if (confirm('Are you sure you want to skip the tutorial?')) {
    endTutorial();
  }
}

function endTutorial() {
  tutorialActive = false;
  const overlay = document.getElementById('tutorial-overlay');
  const launchBtn = document.getElementById('tutorial-btn');
  const character = document.getElementById('tutorial-character');
  
  // Celebration animation
  overlay.classList.add('completed');
  character.style.animation = 'celebrate-spin 1s ease-in-out';
  
  setTimeout(() => {
    overlay.classList.remove('active', 'completed', 'waiting-for-action');
    if (launchBtn) {
      launchBtn.remove(); // Completely remove button
    }
    clearTutorialHighlights();
    character.style.animation = '';
  }, 1200);
}

function checkTutorialAction(actionName) {
  if (!tutorialActive || !tutorialWaitingForAction) return;
  
  const step = tutorialSteps[currentTutorialStep];
  if (step.action === actionName) {
    tutorialCompletedActions.add(actionName);
    tutorialWaitingForAction = false;
    
    // Visual feedback
    const character = document.getElementById('tutorial-character');
    character.style.transform = 'scale(1.2) rotate(10deg)';
    setTimeout(() => {
      character.style.transform = '';
    }, 300);
    
    // Auto-advance after short delay
    setTimeout(() => {
      nextTutorialStep();
    }, 800);
  }
}

// Hook tutorial checks into existing functions
const originalPlayAll = playAll;
playAll = function() {
  checkTutorialAction('click-play');
  return originalPlayAll.apply(this, arguments);
};

const originalStopAll = stopAll;
stopAll = function() {
  if (isRecording) {
    checkTutorialAction('stop-recording');
  } else {
    checkTutorialAction('click-stop');
  }
  return originalStopAll.apply(this, arguments);
};

// Tutorial event listeners
document.getElementById('tutorial-btn')?.addEventListener('click', startTutorial);
document.getElementById('tutorial-next')?.addEventListener('click', nextTutorialStep);
document.getElementById('tutorial-skip')?.addEventListener('click', skipTutorial);

// Hook into view button clicks directly
document.getElementById('arrangeViewBtn')?.addEventListener('click', () => {
  if (tutorialCompletedActions.has('switch-to-mixer')) {
    checkTutorialAction('switch-to-arrangement');
  }
  if (tutorialCompletedActions.has('switch-to-fx')) {
    checkTutorialAction('switch-to-arrangement-2');
  }
});

document.getElementById('mixerViewBtn')?.addEventListener('click', () => {
  checkTutorialAction('switch-to-mixer');
});

document.getElementById('fxViewBtn')?.addEventListener('click', () => {
  checkTutorialAction('switch-to-fx');
});

// Hook into track operations
addTrackBtn?.addEventListener('click', () => {
  checkTutorialAction('add-track');
});

// Monitor for arm button clicks
document.addEventListener('click', (e) => {
  if (e.target.closest('.arm-btn')) {
    checkTutorialAction('arm-track');
  }
});

// Monitor for recording start
if (recordBtn) {
  const originalRecordBtnClick = recordBtn.onclick;
  recordBtn.onclick = function(e) {
    if (!isRecording) {
      checkTutorialAction('start-recording');
    }
    if (originalRecordBtnClick) {
      return originalRecordBtnClick.call(this, e);
    }
  };
}

// Monitor for clip dragging
let clipDragMonitored = false;
document.addEventListener('dragend', (e) => {
  if (e.target.classList.contains('clip') && !clipDragMonitored) {
    checkTutorialAction('drag-clip');
    clipDragMonitored = true;
  }
});
