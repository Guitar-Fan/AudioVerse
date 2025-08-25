import React, { useEffect } from 'react'

// A thin React wrapper that mounts the existing HTML structure and loads your vanilla JS files
export default function App() {
  useEffect(() => {
    // Avoid double-adding in StrictMode
    const head = document.head

    // Add existing CSS from /public (served at root)
    const cssId = 'daw-styles'
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = '/DAWstyling.css'
      head.appendChild(link)
    }

    // Load FXPlugins first (global)
    const fxId = 'fx-plugins-script'
    if (!document.getElementById(fxId)) {
      const fxScript = document.createElement('script')
      fxScript.id = fxId
      fxScript.src = '/FXPlugins.js'
      fxScript.async = false
      head.appendChild(fxScript)
    }

    // Then DAW logic (expects DOM IDs to exist)
    const dawId = 'daw-script'
    const ensureInit = () => {
      // @ts-ignore
      if ((window as any).__DAW_INITED__) return
      // @ts-ignore
      const maybeInit = (window as any).init
      if (typeof maybeInit === 'function') {
        try {
          maybeInit()
          // @ts-ignore
          ;(window as any).__DAW_INITED__ = true
        } catch (e) {
          console.error('DAW init failed', e)
        }
      }
    }

    if (!document.getElementById(dawId)) {
      const dawScript = document.createElement('script')
      dawScript.id = dawId
      dawScript.src = '/DAW.js'
      dawScript.async = false
      dawScript.onload = () => {
        // If the page is already loaded, window.onload assigned inside DAW.js won't fire
        ensureInit()
      }
      head.appendChild(dawScript)
    } else {
      // Script already present; ensure init once
      ensureInit()
    }

    // No cleanup to keep global app running between React remounts
  }, [])

  // Render the same DOM IDs the vanilla script expects
  return (
    <div className="min-w-0 bg-gray-900 text-white overflow-hidden">
      <div id="toolbar" className="bg-gray-800 p-4 border-b-2 border-orange-500 shadow-lg">
        <div className="flex gap-4 items-center justify-between">
          <div className="transport-controls flex gap-2">
            <button id="recordBtn" title="Record (R)" className="p-2 bg-gray-700 rounded hover:bg-red-600 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" fill="currentColor" />
              </svg>
            </button>
            <button id="stopBtn" title="Stop (S)" disabled className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="3" y="3" width="10" height="10" fill="currentColor" />
              </svg>
            </button>
            <button id="playBtn" title="Play (Space)" className="p-2 bg-green-700 rounded hover:bg-green-600 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <polygon points="4,2 4,14 13,8" fill="currentColor" />
              </svg>
            </button>
            <button id="pauseBtn" title="Pause" disabled className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="4" y="2" width="3" height="12" fill="currentColor" />
                <rect x="9" y="2" width="3" height="12" fill="currentColor" />
              </svg>
            </button>
            <div className="view-controls flex gap-1 ml-4 pl-4 border-l border-gray-600">
              <button id="arrangeViewBtn" title="Arrangement View" className="p-1.5 bg-orange-500 text-black rounded text-xs font-semibold active w-8 h-8 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <rect x="1" y="3" width="14" height="2" fill="currentColor" />
                  <rect x="1" y="7" width="14" height="2" fill="currentColor" />
                  <rect x="1" y="11" width="14" height="2" fill="currentColor" />
                  <rect x="3" y="1" width="4" height="6" fill="currentColor" opacity="0.6" />
                  <rect x="9" y="5" width="6" height="6" fill="currentColor" opacity="0.6" />
                </svg>
              </button>
              <button id="mixerViewBtn" title="Mixer View" className="p-1.5 bg-gray-600 text-white rounded text-xs font-semibold w-8 h-8 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <rect x="2" y="2" width="2" height="12" fill="currentColor" />
                  <rect x="7" y="2" width="2" height="12" fill="currentColor" />
                  <rect x="12" y="2" width="2" height="12" fill="currentColor" />
                  <circle cx="3" cy="5" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="13" cy="6" r="1.5" fill="currentColor" />
                </svg>
              </button>
              <button id="fxViewBtn" title="FX Plugins" className="p-1.5 bg-gray-600 text-white rounded text-xs font-semibold w-8 h-8 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" />
                  <circle cx="6" cy="6" r="1.5" fill="#111" />
                  <rect x="8.5" y="5.25" width="4" height="1.5" rx="0.75" fill="#111" />
                  <circle cx="6" cy="10" r="1.5" fill="#111" />
                  <rect x="8.5" y="9.25" width="4" height="1.5" rx="0.75" fill="#111" />
                </svg>
              </button>
              <button id="editorViewBtn" title="Audio Editor" className="p-1.5 bg-gray-600 text-white rounded text-xs font-semibold w-8 h-8 flex items-center justify-center hidden">
                <svg width="12" height="12" viewBox="0 0 16 16">
                  <path d="M2 8 L14 8" stroke="currentColor" strokeWidth="1" />
                  <path d="M1 4 L15 4 L15 12 L1 12 Z" fill="none" stroke="currentColor" strokeWidth="1" />
                  <path d="M3 6 L5 10 L7 4 L9 12 L11 6 L13 10" stroke="currentColor" strokeWidth="1" fill="none" />
                </svg>
              </button>
            </div>
          </div>
          <div className="file-controls flex gap-2">
            <label className="upload-btn p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors cursor-pointer" title="Upload audio">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M8 2L5 5h2v6h2V5h2L8 2z" fill="currentColor" />
                <path d="M2 12h12v2H2z" fill="currentColor" />
              </svg>
              <input type="file" id="fileInput" accept="audio/*" multiple className="hidden" />
            </label>
            <button id="addTrackBtn" title="Add a new track" className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Arrangement Window */}
      <div id="arrangementWindow" className="window active">
        <div className="settings-bar bg-gray-800 p-3 border-b border-gray-700 flex items-center gap-6 text-sm">
          <div className="tempo-section flex items-center gap-2">
            <label htmlFor="bpm" className="text-orange-400 font-semibold">BPM:</label>
            <input type="number" id="bpm" min={20} max={300} defaultValue={120} className="w-16 px-2 py-1 bg-gray-700 border border-orange-400 rounded" />
          </div>
          <div className="time-sig-section flex items-center gap-2">
            <label htmlFor="timeSigNum" className="text-orange-400 font-semibold">Time Sig:</label>
            <select id="timeSigNum" defaultValue="4" className="px-2 py-1 bg-gray-700 border border-red-400 rounded">
              <option value="4">4</option>
              <option value="3">3</option>
              <option value="6">6</option>
              <option value="5">5</option>
              <option value="7">7</option>
            </select>
            <span>/</span>
            <select id="timeSigDen" defaultValue="4" className="px-2 py-1 bg-gray-700 border border-red-400 rounded">
              <option value="4">4</option>
              <option value="8">8</option>
              <option value="16">16</option>
            </select>
          </div>
          <button className="metronome-btn bg-red-500 text-white px-4 py-1 rounded font-semibold hover:bg-orange-500 transition-colors" id="metronomeBtn">
            <svg width="14" height="14" viewBox="0 0 16 16" className="inline mr-1">
              <path d="M8 1L6 4h4L8 1zM7 5v8l-2 2h6l-2-2V5H7z" fill="currentColor" />
              <circle cx="8" cy="9" r="1" fill="currentColor" />
            </svg>
            <span>METRO</span>
          </button>
          <div className="zoom-section flex gap-1">
            <button className="zoom-btn px-3 py-1 bg-gray-700 border border-red-400 text-red-400 rounded hover:bg-red-600 hover:text-white transition-colors" id="zoomInBtn" title="Zoom in">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button className="zoom-btn px-3 py-1 bg-gray-700 border border-red-400 text-red-400 rounded hover:bg-red-600 hover:text-white transition-colors" id="zoomOutBtn" title="Zoom out">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1" />
          <button id="settingsBtn" className="px-3 py-1 bg-gray-700 border border-gray-600 text-gray-300 rounded hover:bg-gray-600 transition-colors flex items-center gap-2" title="Settings (Shift+/)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 20.91 11H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span className="hidden md:inline">Settings</span>
          </button>
        </div>

        <div id="workspace" className="flex-1 overflow-auto bg-gray-900">
          <div id="timeline" className="sticky top-0 z-10"></div>
          <div id="tracks"></div>
        </div>
      </div>

      {/* Mixer Window */}
      <div id="mixerWindow" className="window hidden">
        <div id="mixerContainer" className="flex-1 overflow-auto bg-gradient-to-b from-gray-900 to-gray-800 p-4">
          <div id="mixerChannels" className="flex gap-4 min-h-full"></div>
        </div>
      </div>

      {/* FX Modal */}
      <div id="fxOverlay" className="modal-overlay hidden">
        <div id="fxDialog" className="modal-dialog modal-wide">
          <div className="modal-header">
            <h3>FX Plugins</h3>
            <button id="fxClose" className="modal-close" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div id="fxView" className="modal-content" />
          <div className="modal-footer">
            <button id="fxCloseFooter" className="modal-btn">Close</button>
          </div>
        </div>
      </div>

      {/* Editor Window */}
      <div id="editorWindow" className="window hidden">
        <div className="editor-header bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button id="backButton" className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors" title="Back to Arrangement">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M8 2 L2 8 L8 14 M2 8 L14 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="clip-info">
              <h2 id="editorClipName" className="text-xl font-bold text-white">Audio Editor</h2>
              <p id="editorClipDetails" className="text-sm text-gray-400">No clip selected</p>
            </div>
          </div>
          <div className="editor-tools flex gap-2">
            <button id="editorZoomFit" className="px-3 py-1 bg-gray-700 border border-gray-500 text-gray-300 rounded hover:bg-gray-600 transition-colors" title="Zoom to Fit">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <rect x="1" y="1" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1"/>
                <path d="M4 4 L12 12 M4 12 L12 4" stroke="currentColor" strokeWidth="1"/>
              </svg>
            </button>
            <button id="editorZoomIn" className="px-3 py-1 bg-gray-700 border border-gray-500 text-gray-300 rounded hover:bg-gray-600 transition-colors" title="Zoom In">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button id="editorZoomOut" className="px-3 py-1 bg-gray-700 border border-gray-500 text-gray-300 rounded hover:bg-gray-600 transition-colors" title="Zoom Out">
              <svg width="12" height="12" viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="editor-content flex-1 overflow-hidden bg-gray-900">
          <div id="editorWaveformContainer" className="h-full p-4">
            <div id="editorWaveformDisplay" className="w-full h-full bg-gray-800 rounded-lg border border-gray-700 relative overflow-hidden">
              <canvas id="editorWaveformCanvas" className="w-full h-full"></canvas>
              <div id="editorPlayhead" className="absolute top-0 w-0.5 h-full bg-red-500 z-10 hidden"></div>
              <div id="editorSelection" className="absolute top-0 h-full bg-blue-500 bg-opacity-30 z-5 hidden"></div>
            </div>
            <div id="editorTimeline" className="mt-2 h-8 bg-gray-800 rounded border border-gray-700 relative"></div>
            <div className="editor-controls-panel mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="clip-properties">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Clip Properties</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-24">Start (s)</label>
                      <input id="editorClipStart" type="number" step="0.01" className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-24">Length (s)</label>
                      <input id="editorClipLength" type="number" step="0.01" className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs w-24">Offset (s)</label>
                      <input id="editorClipOffset" type="number" step="0.01" className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs" />
                    </div>
                  </div>
                </div>
                <div className="audio-processing">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Processing</h4>
                  <div className="space-y-2">
                    <button id="editorNormalize" className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors">Normalize</button>
                    <button id="editorReverse" className="w-full px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs transition-colors">Reverse</button>
                    <button id="editorFadeIn" className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors">Fade In</button>
                    <button id="editorFadeOut" className="w-full px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs transition-colors">Fade Out</button>
                  </div>
                </div>
                <div className="selection-tools">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Selection</h4>
                  <div className="space-y-2">
                    <button id="editorSelectAll" className="w-full px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors">Select All</button>
                    <button id="editorClearSelection" className="w-full px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors">Clear</button>
                  </div>
                </div>
                <div className="playback-control">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Playback</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <div id="settingsOverlay" className="modal-overlay hidden">
        <div id="settingsDialog" className="modal-dialog">
          <div className="modal-header">
            <h3>Settings & Shortcuts</h3>
            <button id="settingsClose" className="modal-close" title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="modal-content">
            <section className="modal-section">
              <h4>General</h4>
              <div className="setting-item"><label><input type="checkbox" id="setAutoScroll" /> Auto-scroll during playback</label></div>
              <div className="setting-item"><label><input type="checkbox" id="setSnapToGrid" /> Snap to grid on timeline click</label></div>
              <div className="setting-item"><label><input type="checkbox" id="setTripletGuides" /> Show triplet guides when zoomed in</label></div>
              <div className="setting-item"><label><input type="checkbox" id="setConfirmDelete" /> Confirm before deleting clips</label></div>
            </section>
            <section className="modal-section">
              <h4>Keyboard Shortcuts</h4>
              <div id="shortcutsList" className="shortcuts-list"></div>
            </section>
          </div>
          <div className="modal-footer">
            <button id="settingsSave" className="modal-btn primary">Save</button>
            <button id="settingsCancel" className="modal-btn">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
