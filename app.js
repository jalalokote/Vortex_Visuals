/**
 * VORTEX MODULAR HUD & TD CUSTOM DECK - Main Application Orchestrator
 * Connects Rotary Knobs, WebGL Visual Engine, Purr Data UDP Bridge,
 * Real-Time Beat/Pulse Envelope Generator, and TouchDesigner Live Controller Deck.
 */

(function () {
  'use strict';

  // --- API Base Resolution ---
  const isFileProtocol = window.location.protocol === 'file:';
  const API_BASE = (isFileProtocol || !window.location.host) ? 'http://localhost:3000' : '';

  // --- Toast Notification System ---
  const toastStack = document.getElementById('toastStack');
  function showToast(message, type = 'info', duration = 2800) {
    if (!toastStack) return;
    const toast = document.createElement('div');
    toast.className = `hud-toast ${type === 'warn' ? 'toast--warn' : type === 'cyan' ? 'toast--cyan' : ''}`;
    toast.textContent = message;
    toastStack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // --- DOM Elements ---
  const glCanvas = document.getElementById('glCanvas');
  const tdDeckCanvas = document.getElementById('tdDeckCanvas');
  const tdLiveImage = document.getElementById('tdLiveImage');
  const appHUD = document.getElementById('appHUD');
  const dropOverlay = document.getElementById('dropOverlay');

  const btnEngineWebGL = document.getElementById('btnEngineWebGL');
  const btnEngineTD = document.getElementById('btnEngineTD');
  const engineLed = document.getElementById('engineLed');
  const engineLabel = document.getElementById('engineLabel');
  const fpsReadout = document.getElementById('fpsReadout');

  // TouchDesigner Inspector Bar Elements
  const tdInspectorBar = document.getElementById('tdInspectorBar');
  const tdInspectorReadout = document.getElementById('tdInspectorReadout');
  const btnTdAudioStream = document.getElementById('btnTdAudioStream');
  const btnResetChannelNames = document.getElementById('btnResetChannelNames');
  const btnOpenTdGuide = document.getElementById('btnOpenTdGuide');

  // TouchDesigner Modal Elements
  const tdModal = document.getElementById('tdModal');
  const tdModalLed = document.getElementById('tdModalLed');
  const tdModalStatusPill = document.getElementById('tdModalStatusPill');
  const tdModalFeedback = document.getElementById('tdModalFeedback');
  const tdModalWsInput = document.getElementById('tdModalWsInput');
  const btnTdApplyWs = document.getElementById('btnTdApplyWs');
  const btnTdEnterDeck = document.getElementById('btnTdEnterDeck');
  const btnTdRetry = document.getElementById('btnTdRetry');
  const btnTdCancelToWebGL = document.getElementById('btnTdCancelToWebGL');

  // Photosensitive Epilepsy Warning Modal Elements
  const epilepsyModal = document.getElementById('epilepsyModal');
  const btnAcceptEpilepsyModal = document.getElementById('btnAcceptEpilepsyModal');

  const btnAudioMic = document.getElementById('btnAudioMic');
  const btnAudioThru = document.getElementById('btnAudioThru');
  const audioLed = document.getElementById('audioLed');
  const audioEngineModeBadge = document.getElementById('audioEngineModeBadge');
  const audioDeviceSelect = document.getElementById('audioDeviceSelect');
  const btnLoadAudio = document.getElementById('btnLoadAudio');
  const btnAudioPlayPause = document.getElementById('btnAudioPlayPause');
  const btnAudioLoop = document.getElementById('btnAudioLoop');
  const audioMiniPlayer = document.getElementById('audioMiniPlayer');
  const audioTrackName = document.getElementById('audioTrackName');
  const audioFileInput = document.getElementById('audioFileInput');
  const meterBass = document.getElementById('meterBass');
  const meterMid = document.getElementById('meterMid');
  const meterTreble = document.getElementById('meterTreble');
  const valBass = document.getElementById('valBass');
  const valMid = document.getElementById('valMid');
  const valTreble = document.getElementById('valTreble');
  const btnMatrixBass = document.getElementById('btnMatrixBass');
  const btnMatrixMid = document.getElementById('btnMatrixMid');
  const btnMatrixTreble = document.getElementById('btnMatrixTreble');
  const rackAudio = document.getElementById('rack-audio');

  const midiStatusText = document.getElementById('midiStatusText');
  const btnMidiLearn = document.getElementById('btnMidiLearn');
  const midiLed = document.getElementById('midiLed');

  const wsUrlInput = document.getElementById('wsUrlInput');
  const btnWsConnect = document.getElementById('btnWsConnect');
  const wsLed = document.getElementById('wsLed');

  const btnResetVisuals = document.getElementById('btnResetVisuals');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnToggleHUD = document.getElementById('btnToggleHUD');
  const btnFloatingShowHUD = document.getElementById('btnFloatingShowHUD');

  // Source / Media Bay Elements
  const mediaBay = document.getElementById('mediaBay');
  const btnCollapseBay = document.getElementById('btnCollapseBay');
  const sourceLed = document.getElementById('sourceLed');
  const sourceLabel = document.getElementById('sourceLabel');
  const btnGenerativeMode = document.getElementById('btnGenerativeMode');
  const btnUpload = document.getElementById('btnUpload');
  const fileInput = document.getElementById('fileInput');
  const btnCamera = document.getElementById('btnCamera');
  const dropZone = document.getElementById('dropZone');
  const sampleGrid = document.getElementById('sampleGrid');
  const tdNativeLibrarySection = document.getElementById('tdNativeLibrarySection');
  const tdNativeSampleGrid = document.getElementById('tdNativeSampleGrid');
  const tdPaletteLibrarySection = document.getElementById('tdPaletteLibrarySection');
  const tdPaletteGrid = document.getElementById('tdPaletteGrid');
  const tdMediaBadgePill = document.getElementById('tdMediaBadgePill');
  const localLibraryLabel = document.getElementById('localLibraryLabel');
  const videoTransport = document.getElementById('videoTransport');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnLoop = document.getElementById('btnLoop');

  // Generator Module (Fixed bottom-left) & Labels
  const moduleGen = document.getElementById('moduleGen');
  const tabMediaBtn = document.getElementById('tabMediaBtn');
  const tabGenBtn = document.getElementById('tabGenBtn');
  const tabMediaPanel = document.getElementById('tabMediaPanel');
  const tabGenPanel = document.getElementById('tabGenPanel');
  const webglGenSubpanel = document.getElementById('webglGenSubpanel');
  const genModuleTag = document.getElementById('genModuleTag');
  const genInactiveBanner = document.getElementById('genInactiveBanner');
  const genInactiveNotice = document.getElementById('genInactiveNotice');
  const btnQuickActivateGen = document.getElementById('btnQuickActivateGen');
  const btnAutoFlight3d = document.getElementById('btnAutoFlight3d');
  const moduleTitleSrc = document.getElementById('moduleTitleSrc');
  const fxKnobsTag = document.getElementById('fxKnobsTag');
  const fxModuleTag = document.getElementById('fxModuleTag');

  // Rack Containers (4 Bottom Modules + Audio)
  const rackGen = document.getElementById('rack-gen');
  const rackFxSpace = document.getElementById('rack-fx-space');
  const rackFxColor = document.getElementById('rack-fx-color');
  const rackTempo = document.getElementById('rack-tempo');

  // Performance Pads & Clock Controls
  const btnGlitchBurst = document.getElementById('btnGlitchBurst');
  const btnFreeze = document.getElementById('btnFreeze');
  const btnPixelCrt = document.getElementById('btnPixelCrt');
  const btnClean = document.getElementById('btnClean');
  const btnPulseToggle = document.getElementById('btnPulseToggle');
  const btnBurstFlash = document.getElementById('btnBurstFlash');
  const btnTapBPM = document.getElementById('btnTapBPM');
  const selectBeatDivision = document.getElementById('selectBeatDivision');
  const selectWaveShape = document.getElementById('selectWaveShape');
  const btnLfoTarget = document.getElementById('btnLfoTarget');
  const btnInvert = document.getElementById('btnInvert');
  const btnClockBpm = document.getElementById('btnClockBpm');
  const btnClockKick = document.getElementById('btnClockKick');
  const bpmClockLed = document.getElementById('bpmClockLed');
  const bpmReadoutText = document.getElementById('bpmReadoutText');
  const btnLockBpm = document.getElementById('btnLockBpm');

  // Live Show Sequences, Song Export/Import & Scene Edit Bar
  const btnAutoShow = document.getElementById('btnAutoShow');
  const btnSeqPlay = document.getElementById('btnSeqPlay');
  const btnSeqSave = document.getElementById('btnSeqSave');
  const inputCueName = document.getElementById('inputCueName');
  const btnCueAssignMedia = document.getElementById('btnCueAssignMedia');
  const cueMediaFileInput = document.getElementById('cueMediaFileInput');
  const selectSeqStepBeats = document.getElementById('selectSeqStepBeats');
  const inputCueDuration = document.getElementById('inputCueDuration');
  const selectCueDurationUnit = document.getElementById('selectCueDurationUnit');
  const btnExportShow = document.getElementById('btnExportShow');
  const btnImportShow = document.getElementById('btnImportShow');
  const showFileInput = document.getElementById('showFileInput');
  const seqSceneGrid = document.getElementById('seqSceneGrid');
  const seqStatusBadge = document.getElementById('seqStatusBadge');
  const moduleTitleShow = document.getElementById('moduleTitleShow');
  const moduleShowBadge = document.getElementById('moduleShowBadge');

  // Beat LEDs
  const beatLeds = document.querySelectorAll('.beat-led');

  // --- Theme Manager ---
  class ThemeManager {
    constructor() {
      this.currentTheme = localStorage.getItem('vortex_theme') || 'dark';
      this.applyTheme(this.currentTheme);

      document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.applyTheme(btn.getAttribute('data-theme-btn'));
        });
      });
    }

    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      this.currentTheme = theme;
      localStorage.setItem('vortex_theme', theme);

      document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme-btn') === theme);
      });
    }
  }

  new ThemeManager();

  // --- Initialize WebGL Autonomous Visual Engine ---
  let visualEngine = null;
  try {
    visualEngine = new VisualEngine(glCanvas, {
      onFps: (fps) => {
        if (fpsReadout && activeEngine === 'webgl') {
          fpsReadout.textContent = `${fps} FPS`;
        }
      },
      onThreeCameraReset: () => {
        if (knobs['camOrbit']) knobs['camOrbit'].setValue(180, false, 'three_reset');
        if (knobs['camZoom']) knobs['camZoom'].setValue(58, false, 'three_reset');
      }
    });
    visualEngine.start();
  } catch (err) {
    console.error('[Vortex] WebGL init error:', err);
    if (engineLabel) engineLabel.textContent = 'WebGL Fallback Error';
    if (engineLed) engineLed.className = 'status-led warn';
  }

  // --- Photosensitive Epilepsy Initial Warning Modal ---
  if (epilepsyModal && btnAcceptEpilepsyModal) {
    epilepsyModal.hidden = false;
    epilepsyModal.classList.remove('is-closing');

    const closeEpilepsyModalAndUnlockAudio = () => {
      if (epilepsyModal.classList.contains('is-closing') || epilepsyModal.hidden) return;
      epilepsyModal.classList.add('is-closing');
      try {
        if (visualEngine) {
          const a = visualEngine._ensureAudioGraph();
          if (a && a.context && a.context.state === 'suspended') {
            a.context.resume().catch(() => { });
          }
        }
      } catch (e) { }
      setTimeout(() => {
        epilepsyModal.hidden = true;
      }, 280);
    };

    btnAcceptEpilepsyModal.addEventListener('click', closeEpilepsyModalAndUnlockAudio);
    setTimeout(() => {
      try { btnAcceptEpilepsyModal.focus(); } catch (e) { }
    }, 60);
  }

  // --- Custom Channel Names Persistence (for TouchDesigner Custom Deck) ---
  let customKnobChannels = {};
  let customButtonChannels = {};
  try {
    customKnobChannels = JSON.parse(localStorage.getItem('vortex_td_custom_channels') || '{}') || {};
    customButtonChannels = JSON.parse(localStorage.getItem('vortex_td_custom_buttons') || '{}') || {};
  } catch (e) {
    customKnobChannels = {};
    customButtonChannels = {};
  }

  function saveCustomKnobChannels() {
    try {
      localStorage.setItem('vortex_td_custom_channels', JSON.stringify(customKnobChannels));
    } catch (e) { }
  }

  function saveCustomButtonChannels() {
    try {
      localStorage.setItem('vortex_td_custom_buttons', JSON.stringify(customButtonChannels));
    } catch (e) { }
  }

  // --- Initialize Purr Data UDP -> WebSocket & TouchDesigner Bridge ---
  const defaultWsUrl = localStorage.getItem('vortex_td_ws_url') ||
    (isFileProtocol ? 'ws://localhost:8080' : `ws://${window.location.hostname || 'localhost'}:8080`);
  if (wsUrlInput) wsUrlInput.value = defaultWsUrl;
  if (tdModalWsInput) tdModalWsInput.value = defaultWsUrl;

  let activeEngine = 'webgl'; // 'webgl' | 'td'
  let tdStreamAudioEnabled = false;
  let tdHasIncomingVideoFrame = false;
  let lastMovedKnobId = null;
  let lastMovedKnobTime = 0;

  function formatTdTxMonitor(packet) {
    if (!tdInspectorReadout || !packet) return;
    if (packet.type === 'td_control') {
      const ccTxt = packet.cc !== null && packet.cc !== undefined ? packet.cc : '--';
      tdInspectorReadout.textContent =
        `📡 TX → TD | Canal: "${packet.channel}" | Valor: ${packet.value.toFixed(2)} (real: ${packet.scaledValue}) | MIDI CC: ${ccTxt}`;
    } else if (packet.type === 'td_trigger') {
      tdInspectorReadout.textContent =
        `📡 TX → TD | Trigger: "${packet.action}" | Valor: ${packet.value} | Estado: ${packet.state ? 'ON (1)' : 'OFF (0)'}`;
    } else if (packet.type === 'td_media') {
      tdInspectorReadout.textContent = packet.mode === 'generative'
        ? '📡 TX → TD | Media: Modo Generativo (procedural)'
        : `📡 TX → TD | Media Source: "${packet.absolutePath || packet.source}" (${packet.mediaType})`;
    }
  }

  // Shared Audio Matrix & Live Show Sequencer hooks
  const audioMatrix = { bass: true, mid: true, treble: true };
  let clockAdvanceMode = 'bpm'; // 'bpm' | 'kick'
  let pixelCrtActive = false;
  let bpmLocked = true; // Master BPM stays locked across Cue changes by default
  let currentShowName = 'Mi Show';
  let seqPlaying = false;
  let autoShowEnabled = false;
  let autoShowEnergy = 0;
  let autoShowBand = 'low'; // 'low' | 'mid' | 'high'
  let lastAutoShowPresetTime = 0;
  let autoShowPresetStep = 0;
  let seqStepBeats = 16;
  let seqBeatAccumulator = 0;
  let seqSecondAccumulator = 0;
  let activeSceneIndex = 0;
  let applyShowSceneFn = null;
  let applyColorPresetFn = null;
  let updateCueProgressBarFn = null;
  let lastSceneMidiTriggerTime = 0;

  const midiBridge = new MidiAndBridgeController({
    wsUrl: defaultWsUrl,
    onMidiActivity: (info) => {
      if (midiLed) {
        midiLed.className = 'status-led online';
        midiLed.style.transform = 'scale(1.4)';
        midiLed.style.boxShadow = '0 0 12px var(--accent-amber)';
        setTimeout(() => {
          midiLed.style.transform = 'scale(1)';
          midiLed.style.boxShadow = '';
        }, 70);
      }
      if (midiStatusText && info && info.cc !== undefined) {
        midiStatusText.textContent = `UDP CC ${info.cc} · ${Number(info.value).toFixed(2)}`;
      }
      // Retransmit bio-input for Purr Data CC 80, standard CC 14..17 or active Bio mode
      if (info && info.cc !== undefined) {
        const ccNum = Number(info.cc);
        if (ccNum === 80 || [14, 15, 16, 17].includes(ccNum) || (typeof bioTo3DEnabled !== 'undefined' && bioTo3DEnabled)) {
          applyBioInput(Number(info.value), 'midi_cc_' + ccNum);
        }
      }
      // Trigger Show Sequencer Scenes 1..8 via MIDI CC 21..28 (WebGL mode only)
      if (activeEngine !== 'td' && info && info.cc >= 21 && info.cc <= 28 && Number(info.value) >= 0.5) {
        const nowTs = performance.now();
        if (nowTs - lastSceneMidiTriggerTime >= 220) {
          lastSceneMidiTriggerTime = nowTs;
          if (applyShowSceneFn) applyShowSceneFn(info.cc - 21, 'midi');
        }
      }
    },
    onWsStatusChange: (status, url) => {
      if (!wsLed || !btnWsConnect) return;
      if (status === 'connected') {
        wsLed.className = 'status-led online';
        wsLed.title = `Conectado a ${url} (Puente Purr Data UDP + TouchDesigner activo)`;
        btnWsConnect.textContent = 'Online';
        if (midiLed) midiLed.className = 'status-led online';
        sendCleanTdInitialSync();
      } else if (status === 'connecting') {
        wsLed.className = 'status-led warn';
        wsLed.title = `Conectando a ${url}...`;
        btnWsConnect.textContent = 'Wait';
      } else {
        wsLed.className = 'status-led';
        wsLed.title = 'Desconectado (Modo Standalone)';
        btnWsConnect.textContent = 'Bridge';
      }
    },
    onLearnAssigned: (knob, cc) => {
      showToast(`Purr Data CC #${cc} asignado al canal "${knob.channelName}"`, 'cyan');
    },
    onTdTx: (packet) => {
      formatTdTxMonitor(packet);
    },
    onTdFrame: (dataUri) => {
      // Draw real TouchDesigner output (td_frame base64 JPEG) covering the main TD canvas
      handleIncomingTdFrame(dataUri);
    }
  });

  // --- 🌱 BIO-INPUT (PURR DATA CC80 / NOTES) Integration ---
  const btnBioTo3D = document.getElementById('btnBioTo3D');
  const bioPulseLabel = document.getElementById('bioPulseLabel');
  const meterBio = document.getElementById('meterBio');

  let bioPulse = 0.0;
  let lastBioPulseRaw = 0.0;
  let bioTo3DEnabled = true;

  if (btnBioTo3D) {
    btnBioTo3D.addEventListener('click', () => {
      bioTo3DEnabled = !bioTo3DEnabled;
      if (bioTo3DEnabled) {
        btnBioTo3D.textContent = '🌱 Bio -> Mundo 3D: ON';
        btnBioTo3D.classList.add('active');
        btnBioTo3D.style.borderColor = '#10b981';
        btnBioTo3D.style.color = '#10b981';
        btnBioTo3D.style.background = 'rgba(16,185,129,0.15)';
        showToast('🌱 Bio -> Mundo 3D: Conectado', 'cyan', 1600);
      } else {
        btnBioTo3D.textContent = '🌱 Bio -> Mundo 3D: OFF';
        btnBioTo3D.classList.remove('active');
        btnBioTo3D.style.borderColor = 'rgba(255,255,255,0.2)';
        btnBioTo3D.style.color = 'rgba(255,255,255,0.5)';
        btnBioTo3D.style.background = 'transparent';
        showToast('🌱 Bio -> Mundo 3D: Desconectado', 'amber', 1600);
      }
    });
  }

  function applyBioInput(rawVal, source = 'bio') {
    let val = parseFloat(rawVal);
    if (Number.isNaN(val)) return;
    if (val > 1.0) {
      if (val <= 127.0) val = val / 127.0;
      else if (val <= 1023.0) val = val / 1023.0;
      else if (val <= 4095.0) val = val / 4095.0;
      else val = 1.0;
    }
    val = Math.max(0.0, Math.min(1.0, val));
    const delta = val - lastBioPulseRaw;
    lastBioPulseRaw = val;
    bioPulse = val;

    if (bioPulseLabel) {
      bioPulseLabel.textContent = `🌱 Bio-Pulso: ${bioPulse.toFixed(2)}`;
    }
    if (meterBio) {
      meterBio.style.width = `${Math.round(bioPulse * 100)}%`;
    }

    if (bioTo3DEnabled && visualEngine) {
      if (typeof visualEngine.setBioInput === 'function') {
        visualEngine.setBioInput(bioPulse, delta);
      }
      if (visualEngine.threeEngine && typeof visualEngine.threeEngine.setBioInput === 'function') {
        visualEngine.threeEngine.setBioInput(bioPulse, delta);
      }
    }
  }

  function triggerBioPulsePeak(velocity = 127) {
    const peak = Math.max(0.0, Math.min(1.0, Number(velocity) / 127.0));
    bioPulse = Math.max(bioPulse, peak);
    lastBioPulseRaw = bioPulse;

    if (bioPulseLabel) {
      bioPulseLabel.textContent = `🌱 Bio-Pulso: ${bioPulse.toFixed(2)}`;
    }
    if (meterBio) {
      meterBio.style.width = `${Math.round(bioPulse * 100)}%`;
    }

    if (bioTo3DEnabled && visualEngine) {
      if (typeof visualEngine.setBioInput === 'function') {
        visualEngine.setBioInput(bioPulse, peak);
      }
      if (visualEngine.threeEngine) {
        if (typeof visualEngine.threeEngine.triggerBioPulse === 'function') {
          visualEngine.threeEngine.triggerBioPulse(bioPulse);
        } else if (typeof visualEngine.threeEngine.setBioInput === 'function') {
          visualEngine.threeEngine.setBioInput(bioPulse, peak);
        }
      }
    }
  }

  // Hook WebSocket messages from server (UDP FUDI "bio <val>" or MIDI CC 80 / 14..17 relayed as bio_data)
  const origHandleWsMessage = midiBridge.handleWsMessage.bind(midiBridge);
  midiBridge.handleWsMessage = function (raw) {
    if (typeof raw === 'string') {
      if (raw.includes('bio_data')) {
        try {
          const d = JSON.parse(raw);
          if (d && d.type === 'bio_data') {
            applyBioInput(d.value, d.source || 'ws_bio');
          }
        } catch (_) { }
      } else if (raw.toLowerCase().startsWith('bio')) {
        const parts = raw.trim().replace(/;$/, '').split(/\s+/);
        if (parts.length >= 2) {
          applyBioInput(parts[1], 'udp_bio');
        }
      }
    }
    return origHandleWsMessage(raw);
  };

  // --- Instantiate 12 Hardware Rotary Knobs (CC 1 to CC 12 mounted across Sections A, B, C, E) ---
  const knobDefinitions = [
    // SECCIÓN B (Pestaña Generadores WebGL & Mundos 3D Three.js)
    { parent: rackGen, id: 'frequency', label: 'FREQ', defaultChannel: 'k1_freq', category: 'gen', min: 0.1, max: 1.0, value: 0.35, cc: 1 },
    { parent: rackGen, id: 'detail', label: 'DETAIL', defaultChannel: 'k2_detail', category: 'gen', min: 0.0, max: 1.0, value: 0.50, cc: 2 },
    { parent: rackGen, id: 'speed', label: 'SPEED', defaultChannel: 'k3_speed', category: 'gen', min: 0.0, max: 1.0, value: 0.40, cc: 3 },
    { parent: rackGen, id: 'camOrbit', label: 'CAM ORBIT', defaultChannel: 'k13_cam_orbit', category: 'gen', min: 0, max: 360, step: 1, value: 180, unit: '°', cc: 13 },
    { parent: rackGen, id: 'camZoom', label: 'CAM ZOOM', defaultChannel: 'k14_cam_zoom', category: 'gen', min: 0, max: 100, step: 1, value: 58, unit: '%', cc: 14 },

    // SECCIÓN A (Audio & Reactividad)
    { parent: rackAudio, id: 'audioDepth', label: 'AUDIO SENS', defaultChannel: 'k6_audio', category: 'mod', min: 0.0, max: 1.0, value: 0.50, cc: 6 },

    // SECCIÓN C (FX — Espacio / Deformación)
    { parent: rackFxSpace, id: 'displace', label: 'DISPLACE', defaultChannel: 'k4_displace', category: 'mod', min: 0.0, max: 1.0, value: 0.15, cc: 4 },
    { parent: rackFxSpace, id: 'warpScale', label: 'WARP FRQ', defaultChannel: 'k5_warp', category: 'mod', min: 0.1, max: 1.0, value: 0.45, cc: 5 },
    { parent: rackFxSpace, id: 'kaleido', label: 'KALEIDO', defaultChannel: 'k10_kaleido', category: 'fx', min: 0.0, max: 1.0, value: 0.0, cc: 10 },
    { parent: rackFxSpace, id: 'mirrorAngle', label: 'ANGLE', defaultChannel: 'k11_angle', category: 'fx', min: 0.0, max: 360, step: 1, value: 0.0, unit: '°', cc: 11 },

    // SECCIÓN C (FX — Color / Estela)
    { parent: rackFxColor, id: 'feedback', label: 'FEEDBACK', defaultChannel: 'k7_feedback', category: 'col', min: 0.0, max: 0.96, value: 0.45, cc: 7 },
    { parent: rackFxColor, id: 'chroma', label: 'CHROMA', defaultChannel: 'k8_chroma', category: 'col', min: 0.0, max: 1.0, value: 0.20, cc: 8 },
    { parent: rackFxColor, id: 'hue', label: 'HUE ROT', defaultChannel: 'k9_hue', category: 'col', min: 0.0, max: 360, step: 1, value: 0.0, unit: '°', cc: 9 },

    // SECCIÓN E (Reloj Maestro & Tempo)
    { parent: rackTempo, id: 'bpm', label: 'TEMPO', defaultChannel: 'k12_bpm', category: 'fx', min: 40, max: 200, step: 1, value: 120, unit: 'BPM', cc: 12 }
  ];

  const knobs = {};
  const knobList = [];

  knobDefinitions.forEach(def => {
    if (!def.parent) return;

    // Fixed default TD channel names (renaming disabled)
    const knob = new RotaryKnob({
      id: def.id,
      label: def.label,
      channelName: def.defaultChannel,
      customLabel: null,
      customChannel: def.defaultChannel,
      category: def.category,
      min: def.min,
      max: def.max,
      step: def.step,
      value: def.value,
      unit: def.unit,
      cc: def.cc,
      onChange: (val, normVal, instance, source) => {
        lastMovedKnobId = def.id;
        lastMovedKnobTime = performance.now();

        if (def.id === 'bpm') {
          currentBpm = Number(val) || 120;
          if (visualEngine) visualEngine.setBPM(currentBpm);
          if (bpmReadoutText) bpmReadoutText.textContent = `${Math.round(currentBpm)} BPM`;
        } else if (def.id === 'camOrbit') {
          if (visualEngine) visualEngine.setThreeCameraOrbit(normVal);
        } else if (def.id === 'camZoom') {
          if (visualEngine) visualEngine.setThreeCameraZoom(normVal);
        } else if (visualEngine) {
          visualEngine.setParam(def.id, normVal);
          if (def.id === 'mirrorAngle' && visualEngine.threeEngine && typeof visualEngine.threeEngine.setMorphAngle === 'function') {
            visualEngine.threeEngine.setMorphAngle(normVal);
          }
          if (def.id === 'chroma' && normVal > 0.02) {
            visualEngine.params.monochrome = false;
          }
        }

        // If user turns a generator knob in WebGL mode while media is active, remind them subtly
        if (
          activeEngine === 'webgl' &&
          source === 'ui' &&
          def.category === 'gen' &&
          visualEngine &&
          visualEngine.sourceMode === 'media'
        ) {
          showToast('Panel 1 actúa en Modo Generativo (pulsa "🌀 Modo Generativo" para verlo)', 'warn', 2000);
        }

        // Block generator knob transmission when in TD mode so panel 1 never interferes
        if (activeEngine === 'td' && def.category === 'gen') {
          return;
        }

        // Point 2a: ALWAYS transmit td_control when a knob moves (whether via mouse OR Purr Data UDP!)
        if (midiBridge) {
          midiBridge.sendTdControl({
            id: def.id,
            channel: instance.channelName || instance.label,
            cc: instance.cc,
            value: normVal,
            scaledValue: val
          });
        }
      },
      onMidiLearnArm: (instance) => {
        if (midiBridge) midiBridge.armKnobForMidi(instance);
      }
    });

    def.parent.appendChild(knob.container);
    knobs[def.id] = knob;
    knobList.push(knob);
    midiBridge.registerKnob(knob);
  });

  // Guarantee AUDIO SENS keeps CC 6 active (never stuck showing "NO CC" from stale storage)
  const audioSensKnob = knobs['audioDepth'];
  if (audioSensKnob && audioSensKnob.cc !== 6) {
    const ownerOfCc6 = midiBridge.ccMap.get(6);
    if (!ownerOfCc6 || !knobs[ownerOfCc6] || audioSensKnob.cc === null || audioSensKnob.cc === undefined) {
      midiBridge.ccMap.forEach((kId, existingCc) => {
        if (kId === 'audioDepth') midiBridge.ccMap.delete(existingCc);
      });
      midiBridge.ccMap.set(6, 'audioDepth');
      audioSensKnob.setMidiCC(6);
      midiBridge.saveMappings();
    }
  }

  // --- Fixed Action Button TD Channels (no rename popups) ---
  // Media transport buttons also get fixed TD trigger IDs
  if (btnPlayPause && !btnPlayPause.hasAttribute('data-action-id')) {
    btnPlayPause.setAttribute('data-action-id', 'media_pause');
  }
  if (btnLoop && !btnLoop.hasAttribute('data-action-id')) {
    btnLoop.setAttribute('data-action-id', 'media_loop');
  }

  // Discard any legacy custom channel names stored by the old rename popups
  customKnobChannels = {};
  customButtonChannels = {};
  try {
    localStorage.removeItem('vortex_td_custom_channels');
    localStorage.removeItem('vortex_td_custom_buttons');
  } catch (e) { }

  const actionButtons = document.querySelectorAll('[data-action-id]');
  const defaultButtonLabels = {};

  actionButtons.forEach(btn => {
    const actionId = btn.getAttribute('data-action-id');
    defaultButtonLabels[actionId] = btn.textContent.trim();
    btn.setAttribute('data-td-channel', actionId);
  });

  function emitTdTriggerForButton(btn, state = true, value) {
    if (!midiBridge || !btn) return;
    const actionId = btn.getAttribute('data-action-id') || btn.id || 'trigger';
    // Never send generator triggers while in TD mode to prevent switching or glitching TD media
    if (activeEngine === 'td' && actionId.startsWith('gen_')) {
      return;
    }
    midiBridge.sendTdTrigger({
      id: actionId,
      action: btn.getAttribute('data-td-channel') || actionId,
      value: value !== undefined ? value : (state ? 1 : 0),
      state: state
    });
  }

  // Restore All Custom Channel Names Button
  if (btnResetChannelNames) {
    btnResetChannelNames.addEventListener('click', () => {
      customKnobChannels = {};
      customButtonChannels = {};
      try {
        localStorage.removeItem('vortex_td_custom_channels');
        localStorage.removeItem('vortex_td_custom_buttons');
      } catch (e) { }

      knobDefinitions.forEach(def => {
        const k = knobs[def.id];
        if (k) {
          k.resetName();
          k.channelName = def.defaultChannel;
        }
      });

      actionButtons.forEach(btn => {
        const actionId = btn.getAttribute('data-action-id');
        btn.setAttribute('data-td-channel', actionId);
      });

      showToast('Nombres de canales restaurados a sus valores originales', 'cyan');
    });
  }

  // --- Real-Time Beat / Pulse Accumulator & TD Audio FFT Streamer + TD Signal Visualizer ---
  let pulseEnabled = false;     // OFF by default so image never blinks/jumps unless enabled
  let currentBpm = 120;         // 40 .. 200 BPM
  let beatMultiplier = 1;       // 1 (x1 beat), 2 (x2 beats), 4 (x4 beats)
  let waveShape = 'sine';       // 'sine' | 'saw' | 'square' | 'triangle'
  let beatPhase = 0.0;
  let lastPulseTime = performance.now();
  let lastBeatLedStep = -1;
  let lastTdAudioSentTime = 0;

  function computeWaveEnvelope(phase, shape) {
    const frac = phase - Math.floor(phase);
    switch (shape) {
      case 'saw':
        return 1.0 - frac;
      case 'square':
        return frac < 0.5 ? 1.0 : 0.0;
      case 'triangle':
        return 1.0 - Math.abs(2.0 * frac - 1.0);
      case 'sine':
      default:
        return 0.5 + 0.5 * Math.sin(frac * Math.PI * 2.0);
    }
  }

  // Resize & render the TouchDesigner 12-Channel Signal Visualizer Canvas (Point 3d)
  const tdDeckCtx = tdDeckCanvas ? tdDeckCanvas.getContext('2d') : null;

  // --- Live TouchDesigner frames over WebSocket ({ type: "td_frame", data: base64Jpeg }) ---
  const tdFrameImg = new Image();
  let tdWsFramesActive = false;
  let lastTdWsFrameTime = 0;
  const TD_FRAME_TIMEOUT_MS = 2500;
  let isDrawingTdFrame = false;
  let tdFrameRafId = null;
  let lastTdFrameDataUri = null;

  function drawTdFrameCover(img) {
    if (!tdDeckCanvas || !tdDeckCtx) return;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (tdDeckCanvas.width !== w || tdDeckCanvas.height !== h) {
      tdDeckCanvas.width = w;
      tdDeckCanvas.height = h;
    }
    const scale = Math.max(w / iw, h / ih); // "cover" fit
    const dw = iw * scale;
    const dh = ih * scale;
    tdDeckCtx.setTransform(1, 0, 0, 1, 0, 0);
    tdDeckCtx.imageSmoothingEnabled = true;
    tdDeckCtx.imageSmoothingQuality = 'medium';
    tdDeckCtx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  tdFrameImg.onload = () => {
    if (activeEngine !== 'td' || !tdWsFramesActive) {
      isDrawingTdFrame = false;
      return;
    }
    if (tdFrameRafId !== null) cancelAnimationFrame(tdFrameRafId);
    tdFrameRafId = requestAnimationFrame(() => {
      tdFrameRafId = null;
      try {
        if (activeEngine === 'td' && tdWsFramesActive) {
          drawTdFrameCover(tdFrameImg);
        }
      } finally {
        isDrawingTdFrame = false;
      }
    });
  };

  tdFrameImg.onerror = () => {
    isDrawingTdFrame = false;
  };

  function handleIncomingTdFrame(dataUri) {
    if (activeEngine !== 'td' || !dataUri) return;
    lastTdWsFrameTime = performance.now();

    if (!tdWsFramesActive) {
      // First frame: hide telemetry bars & MJPEG <img>, use the canvas as TD video surface
      tdWsFramesActive = true;
      tdHasIncomingVideoFrame = true;
      if (tdLiveImage) {
        tdLiveImage.classList.remove('active');
        tdLiveImage.removeAttribute('src');
      }
      if (tdDeckCanvas) tdDeckCanvas.hidden = false;
      if (glCanvas) glCanvas.style.display = 'none';
    }

    // Drop incoming frame if previous frame hasn't finished decoding/painting via rAF yet
    if (isDrawingTdFrame || dataUri === lastTdFrameDataUri) return;

    isDrawingTdFrame = true;
    lastTdFrameDataUri = dataUri;
    tdFrameImg.src = dataUri;
  }

  function resetTdFrameState() {
    tdWsFramesActive = false;
    isDrawingTdFrame = false;
    lastTdFrameDataUri = null;
    if (tdFrameRafId !== null) {
      cancelAnimationFrame(tdFrameRafId);
      tdFrameRafId = null;
    }
  }
  function renderTdDeckVisualizer(now, envelope) {
    if (!tdDeckCanvas || !tdDeckCtx || tdDeckCanvas.hidden) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (tdDeckCanvas.width !== w || tdDeckCanvas.height !== h) {
      tdDeckCanvas.width = w;
      tdDeckCanvas.height = h;
    }

    const ctx = tdDeckCtx;
    ctx.save();
    ctx.scale(dpr, dpr);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Background gradient + subtle technical grid
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, vw, vh);

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < vw; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vh);
      ctx.stroke();
    }
    for (let y = 0; y < vh; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
      ctx.stroke();
    }

    // Center Telemetry Panel (placed cleanly between Media Bay on left and Bottom Rack)
    const panelLeft = Math.min(320, vw * 0.24);
    const panelRight = vw - 32;
    const panelWidth = Math.max(320, panelRight - panelLeft);
    const panelTop = 112;
    const panelHeight = Math.max(180, vh - 410);

    // Header text
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('TOUCHDESIGNER LIVE SIGNAL MATRIX // 12 CHANNELS + FFT TELEMETRY', panelLeft, panelTop);

    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    const wsStateTxt = midiBridge.isWsConnected || midiBridge.isTdDirectConnected ? 'ONLINE (TX ACTIVE)' : 'WAITING FOR TD WEBSOCKET';
    ctx.fillText(`WS: ${wsUrlInput ? wsUrlInput.value : 'ws://localhost:8080'} · STATUS: ${wsStateTxt}`, panelLeft, panelTop + 18);

    // Draw 12 Channel Bars
    const barsTop = panelTop + 36;
    const barsHeight = Math.max(90, panelHeight - 65);
    const gap = 10;
    const barW = Math.max(28, (panelWidth - gap * 11) / 12);

    knobList.forEach((knob, i) => {
      const x = panelLeft + i * (barW + gap);
      const norm = knob.getNormalized();
      const fillH = Math.max(4, norm * barsHeight);
      const isRecentlyMoved = (knob.id === lastMovedKnobId) && (now - lastMovedKnobTime < 350);

      // Bar track
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = isRecentlyMoved ? '#ff6d00' : 'rgba(0, 229, 255, 0.22)';
      ctx.lineWidth = isRecentlyMoved ? 1.8 : 1;
      ctx.beginPath();
      ctx.roundRect(x, barsTop, barW, barsHeight, 4);
      ctx.fill();
      ctx.stroke();

      // Bar fill gradient
      const grad = ctx.createLinearGradient(0, barsTop + barsHeight, 0, barsTop);
      grad.addColorStop(0, 'rgba(255, 109, 0, 0.75)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.9)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 2, barsTop + barsHeight - fillH, barW - 4, fillH, 3);
      ctx.fill();

      // Value text inside bar
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(norm.toFixed(2), x + barW / 2, barsTop + barsHeight - 8);

      // Channel Name below bar
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = isRecentlyMoved ? '#ffb74d' : '#00e5ff';
      const chName = (knob.channelName || knob.label).slice(0, 10);
      ctx.fillText(chName, x + barW / 2, barsTop + barsHeight + 14);

      // CC number
      ctx.font = '500 8px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText(knob.cc ? `CC ${knob.cc}` : '--', x + barW / 2, barsTop + barsHeight + 25);
    });

    // Audio FFT & Beat Pulse mini indicator on top-right of matrix
    const bass = visualEngine ? visualEngine.audio.bass : 0;
    const mid = visualEngine ? visualEngine.audio.mid : 0;
    const treble = visualEngine ? visualEngine.audio.treble : 0;
    ctx.textAlign = 'right';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillStyle = tdStreamAudioEnabled ? '#ffb74d' : 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(
      `FFT TX: ${tdStreamAudioEnabled ? 'ON' : 'OFF'} | BASS ${bass.toFixed(2)} · MID ${mid.toFixed(2)} · HIGH ${treble.toFixed(2)} | ${currentBpm} BPM`,
      panelRight,
      panelTop + 10
    );

    ctx.restore();
  }

  let lastTrebleBurstTime = 0;
  let lastKickAdvanceTime = 0;
  let prevKickBass = 0;

  function updateMasterLoop(now) {
    requestAnimationFrame(updateMasterLoop);

    const deltaTime = Math.min(0.1, Math.max(0.0, (now - lastPulseTime) / 1000.0));
    lastPulseTime = now;

    // Smooth decay for Bio-Pulso (Purr Data CC 80 / MIDI Notes)
    if (typeof bioPulse === 'number' && bioPulse > 0.001) {
      bioPulse = Math.max(0.0, bioPulse - deltaTime * 0.85);
      if (bioPulseLabel) {
        bioPulseLabel.textContent = `🌱 Bio-Pulso: ${bioPulse.toFixed(2)}`;
      }
      if (meterBio) {
        meterBio.style.width = `${Math.round(bioPulse * 100)}%`;
      }
      if (typeof bioTo3DEnabled !== 'undefined' && bioTo3DEnabled && visualEngine) {
        if (typeof visualEngine.setBioInput === 'function') {
          visualEngine.setBioInput(bioPulse, -deltaTime * 0.85);
        }
        if (visualEngine.threeEngine && typeof visualEngine.threeEngine.setBioInput === 'function') {
          visualEngine.threeEngine.setBioInput(bioPulse, -deltaTime * 0.85);
        }
      }
    }

    // Read live BPM directly from TEMPO knob (CC 12) so visual clock & WebGL speed react instantaneously
    const liveBpm = knobs['bpm'] ? (Number(knobs['bpm'].value) || currentBpm) : currentBpm;
    currentBpm = liveBpm;
    if (visualEngine) visualEngine.setBPM(liveBpm);
    if (bpmReadoutText) bpmReadoutText.textContent = `${Math.round(liveBpm)} BPM`;

    // Accumulate phase: beatPhase += dt * (bpm / 60.0) * divisionMultiplier
    beatPhase += deltaTime * (liveBpm / 60.0) * beatMultiplier;
    const beatFrac = beatPhase - Math.floor(beatPhase);

    // Visual Beat Pulse LED next to BPM readout always blinks on beat to confirm real tempo speed
    if (bpmClockLed) {
      bpmClockLed.classList.toggle('flash', beatFrac < 0.24);
    }

    let currentEnvelope = 0.0;

    if (!pulseEnabled) {
      if (visualEngine) {
        visualEngine.setPulseEnabled(false);
        visualEngine.setPulseEnvelope(0.0);
      }
      if (lastBeatLedStep !== -1) {
        lastBeatLedStep = -1;
        beatLeds.forEach(led => led.classList.remove('active'));
      }
    } else {
      currentEnvelope = computeWaveEnvelope(beatPhase, waveShape);
      if (visualEngine) {
        visualEngine.setPulseEnabled(true);
        visualEngine.setPulseEnvelope(currentEnvelope);
      }

      const currentStep = Math.floor(beatPhase) % 4;
      if (currentStep !== lastBeatLedStep) {
        lastBeatLedStep = currentStep;
        beatLeds.forEach((led, idx) => {
          led.classList.toggle('active', idx === currentStep);
        });
      }
    }

    // Live FFT Reading, Bar Meters & Audio -> FX Matrix Routing
    const audioSens = knobs['audioDepth'] ? knobs['audioDepth'].getNormalized() : 0.5;
    let rawBass = 0;
    let rawMid = 0;
    let rawTreble = 0;
    let spectrum16 = [];
    if (visualEngine && visualEngine.audio && visualEngine.audio.active) {
      visualEngine.readAudio(audioSens);
      rawBass = visualEngine.audio.bass || 0;
      rawMid = visualEngine.audio.mid || 0;
      rawTreble = visualEngine.audio.treble || 0;
      spectrum16 = Array.isArray(visualEngine.audio.spectrum16) ? visualEngine.audio.spectrum16 : [];
    }

    if (visualEngine && visualEngine.threeEngine && typeof visualEngine.threeEngine.updateAudio === 'function') {
      visualEngine.threeEngine.updateAudio({
        bass: rawBass,
        mid: rawMid,
        treble: rawTreble,
        spectrum16
      });
    }

    const bassNorm = Math.min(1, rawBass);
    const midNorm = Math.min(1, rawMid);
    const trebleNorm = Math.min(1, rawTreble);

    if (meterBass) meterBass.style.transform = `scaleX(${bassNorm.toFixed(3)})`;
    if (meterMid) meterMid.style.transform = `scaleX(${midNorm.toFixed(3)})`;
    if (meterTreble) meterTreble.style.transform = `scaleX(${trebleNorm.toFixed(3)})`;
    if (valBass) valBass.textContent = rawBass.toFixed(2);
    if (valMid) valMid.textContent = rawMid.toFixed(2);
    if (valTreble) valTreble.textContent = rawTreble.toFixed(2);

    if (activeEngine === 'webgl' && visualEngine) {
      if (visualEngine.audio && visualEngine.audio.active && audioSens > 0.01 && !autoShowEnabled) {
        const baseDisplace = knobs['displace'] ? knobs['displace'].getNormalized() : 0.15;
        const baseFeedback = knobs['feedback'] ? knobs['feedback'].getNormalized() : 0.45;
        const baseChroma = knobs['chroma'] ? knobs['chroma'].getNormalized() : 0.2;
        const baseKaleido = knobs['kaleido'] ? knobs['kaleido'].getNormalized() : 0.0;

        visualEngine.setParam(
          'displace',
          audioMatrix.bass ? Math.min(1.0, baseDisplace + rawBass * audioSens * 0.45) : baseDisplace
        );
        visualEngine.setParam(
          'feedback',
          audioMatrix.mid ? Math.min(0.96, baseFeedback + rawMid * audioSens * 0.28) : baseFeedback
        );
        visualEngine.setParam(
          'chroma',
          audioMatrix.mid ? Math.min(1.0, baseChroma + rawMid * audioSens * 0.35) : baseChroma
        );
        if (audioMatrix.treble) {
          visualEngine.setParam('kaleido', Math.min(1.0, baseKaleido + rawTreble * audioSens * 0.3));
          if (rawTreble * audioSens > 0.38 && now - lastTrebleBurstTime > 260) {
            lastTrebleBurstTime = now;
            visualEngine.triggerBurst();
          }
        } else {
          visualEngine.setParam('kaleido', baseKaleido);
        }
      }
    }

    // 🚀 AUTO-SHOW ENGINE: Continuous energy adaptation (Intro/Break -> Verso -> Coro/Drop)
    if (autoShowEnabled) {
      const instantEnergy = rawBass * 0.48 + rawMid * 0.32 + rawTreble * 0.20;
      autoShowEnergy = autoShowEnergy * 0.84 + instantEnergy * 0.16;
      const bassTransient = (rawBass - prevKickBass) > 0.11 && rawBass > 0.52;
      const nextBand = (autoShowEnergy >= 0.45 || bassTransient)
        ? 'high'
        : (autoShowEnergy >= 0.15 ? 'mid' : 'low');

      if (activeEngine === 'webgl' && visualEngine) {
        if (nextBand === 'low') {
          visualEngine.setParam('displace', 0.08 + rawBass * 0.06);
          visualEngine.setParam('feedback', 0.28 + rawMid * 0.12);
          visualEngine.setParam('chroma', 0.12);
          visualEngine.setParam('kaleido', 0.0);
        } else if (nextBand === 'mid') {
          visualEngine.setParam('displace', Math.min(0.75, 0.20 + rawBass * 0.28));
          visualEngine.setParam('feedback', Math.min(0.85, 0.45 + rawMid * 0.25));
          visualEngine.setParam('chroma', Math.min(0.85, 0.32 + rawMid * 0.30));
          visualEngine.setParam('kaleido', Math.min(0.45, rawTreble * 0.30));
        } else {
          visualEngine.setParam('displace', Math.min(1.0, 0.40 + rawBass * 0.50));
          visualEngine.setParam('feedback', Math.min(0.95, 0.66 + rawMid * 0.26));
          visualEngine.setParam('chroma', Math.min(1.0, 0.62 + rawTreble * 0.35));
          visualEngine.setParam('kaleido', Math.min(1.0, 0.42 + rawTreble * 0.45));
        }
      }

      if (nextBand !== autoShowBand) {
        autoShowBand = nextBand;
        if (nextBand === 'low' && applyColorPresetFn) {
          applyColorPresetFn('original', true);
        } else if (nextBand === 'mid' && applyColorPresetFn) {
          applyColorPresetFn('cyberpunk', true);
        } else if (nextBand === 'high') {
          if (visualEngine) visualEngine.triggerBurst();
          if (applyColorPresetFn) applyColorPresetFn('infrared', true);
        }
      } else if (nextBand === 'high' && (Math.floor(beatPhase) % 4 === 0) && (now - lastAutoShowPresetTime) > 1400) {
        lastAutoShowPresetTime = now;
        const dropPalettes = ['cyberpunk', 'infrared', 'mono', 'original'];
        autoShowPresetStep = (autoShowPresetStep + 1) % dropPalettes.length;
        if (applyColorPresetFn) applyColorPresetFn(dropPalettes[autoShowPresetStep], true);
        if (visualEngine) visualEngine.triggerBurst();
      }
    }

    // Stream Audio FFT + BPM to TouchDesigner throttled at max ~25 FPS (40ms)
    const TD_AUDIO_THROTTLE_MS = 40;
    if (tdStreamAudioEnabled && midiBridge && now - lastTdAudioSentTime >= TD_AUDIO_THROTTLE_MS) {
      lastTdAudioSentTime = now;
      midiBridge.sendTdAudio({
        bass: audioMatrix.bass ? rawBass : 0,
        mid: audioMatrix.mid ? rawMid : 0,
        treble: audioMatrix.treble ? rawTreble : 0,
        bpm: liveBpm,
        beatEnvelope: currentEnvelope
      });
    }

    // Live Show Sequencer Automatic Advance (Individual Cue Beats / Seconds Timeline + Progress Bar)
    if (seqPlaying && applyShowSceneFn) {
      if (clockAdvanceMode === 'kick') {
        if (updateCueProgressBarFn) updateCueProgressBarFn(activeSceneIndex, 0);
        if (rawBass >= 0.40 && (rawBass - prevKickBass) > 0.07 && (now - lastKickAdvanceTime) > 280) {
          lastKickAdvanceTime = now;
          applyShowSceneFn((activeSceneIndex + 1) % 8, 'seq');
        }
      } else {
        const cueDuration = inputCueDuration
          ? Math.max(1, Number(inputCueDuration.value) || seqStepBeats)
          : seqStepBeats;
        const cueUnit = selectCueDurationUnit ? selectCueDurationUnit.value : 'beats';

        if (cueUnit === 'seconds') {
          seqSecondAccumulator += deltaTime;
          const progress = Math.min(1, seqSecondAccumulator / cueDuration);
          if (updateCueProgressBarFn) updateCueProgressBarFn(activeSceneIndex, progress);
          if (seqSecondAccumulator >= cueDuration) {
            seqSecondAccumulator = 0;
            seqBeatAccumulator = 0;
            applyShowSceneFn((activeSceneIndex + 1) % 8, 'seq');
          }
        } else {
          seqBeatAccumulator += deltaTime * (liveBpm / 60.0);
          const progress = Math.min(1, seqBeatAccumulator / cueDuration);
          if (updateCueProgressBarFn) updateCueProgressBarFn(activeSceneIndex, progress);
          if (seqBeatAccumulator >= cueDuration) {
            seqBeatAccumulator -= cueDuration;
            seqSecondAccumulator = 0;
            applyShowSceneFn((activeSceneIndex + 1) % 8, 'seq');
          }
        }
      }
    } else if (updateCueProgressBarFn) {
      updateCueProgressBarFn(-1, 0);
    }
    prevKickBass = rawBass;

    // If TD WebSocket frames stop arriving, fall back to the telemetry matrix
    if (tdWsFramesActive && now - lastTdWsFrameTime > TD_FRAME_TIMEOUT_MS) {
      resetTdFrameState();
      tdHasIncomingVideoFrame = false;
    }

    // Render TD Signal Matrix if in TD mode without incoming video stream
    if (activeEngine === 'td' && !tdHasIncomingVideoFrame) {
      renderTdDeckVisualizer(now, currentEnvelope);
    }
  }

  requestAnimationFrame(updateMasterLoop);

  // --- SOURCE / MEDIA BAY & GENERATOR PANEL CLARITY (Points 1 & 4) ---
  const sampleMediaList = [
    { id: 'city', title: 'Ciudad Cyber', mediaType: 'image', file: 'media/city.jpg', thumb: 'media/thumbs/city.jpg' },
    { id: 'dancer', title: 'Danza Neon', mediaType: 'image', file: 'media/dancer.jpg', thumb: 'media/thumbs/dancer.jpg' },
    { id: 'ocean', title: 'Océano', mediaType: 'image', file: 'media/ocean.jpg', thumb: 'media/thumbs/ocean.jpg' },
    { id: 'flowers', title: 'Flores', mediaType: 'image', file: 'media/flowers.jpg', thumb: 'media/thumbs/flowers.jpg' },
    { id: 'concert', title: 'Concierto', mediaType: 'image', file: 'media/concert.jpg', thumb: 'media/thumbs/concert.jpg' }
  ];
  const PROTECTED_SAMPLE_IDS = new Set(['city', 'dancer', 'ocean', 'flowers', 'concert']);
  const CUSTOM_MEDIA_STORAGE_KEY = 'vortex_custom_media_v1';
  const DELETED_MEDIA_STORAGE_KEY = 'vortex_deleted_media_ids_v1';
  const customMediaList = [];
  let onCustomMediaDeletedFn = null;

  function getDeletedCustomMediaIds() {
    try {
      const raw = JSON.parse(localStorage.getItem(DELETED_MEDIA_STORAGE_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (e) {
      return new Set();
    }
  }

  function markCustomMediaDeleted(itemId) {
    if (!itemId) return;
    try {
      const set = getDeletedCustomMediaIds();
      set.add(itemId);
      localStorage.setItem(DELETED_MEDIA_STORAGE_KEY, JSON.stringify([...set]));
    } catch (e) { }
  }

  function persistCustomMediaList() {
    const serializable = customMediaList.map(item => ({
      id: item.id,
      title: item.title,
      fileName: item.fileName || item.title,
      mediaType: item.mediaType || 'image',
      isCustom: true,
      file: (item.uploadPath || (item.file && !String(item.file).startsWith('blob:') ? item.file : null)) || item.dataUrl || null,
      src: item.dataUrl || item.uploadPath || (item.src && !String(item.src).startsWith('blob:') ? item.src : null) || null,
      thumb: item.thumb && !String(item.thumb).startsWith('blob:') ? item.thumb : (item.dataUrl || null),
      dataUrl: item.dataUrl || null,
      uploadPath: item.uploadPath || null,
      serverPath: item.serverPath || item.uploadPath || null,
      absolutePath: item.absolutePath || null
    })).filter(item => Boolean(item.src || item.file || item.dataUrl || item.uploadPath));

    try {
      localStorage.setItem(CUSTOM_MEDIA_STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      try {
        const lean = serializable.map(item => {
          const copy = { ...item };
          if (copy.uploadPath && copy.dataUrl && copy.dataUrl.length > 220000) {
            delete copy.dataUrl;
            copy.src = copy.uploadPath;
          }
          return copy;
        });
        localStorage.setItem(CUSTOM_MEDIA_STORAGE_KEY, JSON.stringify(lean));
      } catch (e2) { }
    }
  }

  function loadPersistedCustomMediaList() {
    try {
      const deletedIds = getDeletedCustomMediaIds();
      const raw = JSON.parse(localStorage.getItem(CUSTOM_MEDIA_STORAGE_KEY) || '[]');
      if (!Array.isArray(raw)) return;
      raw.forEach(item => {
        if (!item || !item.id || PROTECTED_SAMPLE_IDS.has(item.id) || deletedIds.has(item.id)) return;
        const resolved = item.dataUrl || item.uploadPath || item.serverPath || item.src || item.file;
        if (!resolved || String(resolved).startsWith('blob:')) return;
        if (!customMediaList.some(m => m.id === item.id)) {
          customMediaList.push({
            ...item,
            isCustom: true,
            file: item.uploadPath || item.file || resolved,
            src: resolved,
            thumb: item.thumb || item.dataUrl || resolved
          });
        }
      });
    } catch (e) { }
  }

  loadPersistedCustomMediaList();

  // 3a. Native HD Samples included with TouchDesigner (Samples/Map)
  const tdNativeSamplesList = [
    { id: 'td_nature', label: '🎬 Nature Loop (TD HD)', source: 'td_sample:Nature1.mov', mediaType: 'video' },
    { id: 'td_count', label: '🎞️ Count Loop (TD HD)', source: 'td_sample:Count.mov', mediaType: 'video' },
    { id: 'td_cloud', label: '☁️ Cloud Map (TD HD)', source: 'td_sample:Cloud.jpg', mediaType: 'image' },
    { id: 'td_butterfly', label: '🦋 Butterfly (TD HD)', source: 'td_sample:MovieFileIn_Default.jpg', mediaType: 'image' }
  ];

  // 3b. Real-Time TouchDesigner Palette Generators
  const tdPaletteGeneratorsList = [
    { id: 'td_pal_reaction', label: '🧬 Reaction Diffusion', source: 'td_palette:reaction' },
    { id: 'td_pal_voronoi', label: '🔮 Voronoi Cellular 4D', source: 'td_palette:voronoi' },
    { id: 'td_pal_tunnel', label: '🌐 Cyber Grid Tunnel', source: 'td_palette:tunnel' },
    { id: 'td_pal_plasma', label: '🌊 Spectral Plasma', source: 'td_palette:plasma' }
  ];

  const genModeNames = ['Fluid', 'Vortex', 'Rings', 'Geo'];
  const threeWorldNames = ['Aquarium 3D', 'Endless Drive 3D', 'Bio-Terra 3D', 'Catedral / LiDAR 3D'];
  let currentVideoElement = null;
  let currentSourceSnapshot = { kind: 'generator', genMode: 0, tdPaletteId: 'td_pal_reaction', sampleId: null, sourceName: 'Gen: Fluid' };

  // Source Tab Switcher (Sección B: 🖼️ Medios / HD vs ⚡ Generadores)
  function switchSourceTab(tabName) {
    const isGenTab = (tabName === 'generators');
    if (tabMediaBtn) {
      tabMediaBtn.classList.toggle('active', !isGenTab);
      tabMediaBtn.setAttribute('aria-selected', String(!isGenTab));
    }
    if (tabGenBtn) {
      tabGenBtn.classList.toggle('active', isGenTab);
      tabGenBtn.setAttribute('aria-selected', String(isGenTab));
    }
    if (tabMediaPanel) tabMediaPanel.hidden = isGenTab;
    if (tabGenPanel) tabGenPanel.hidden = !isGenTab;
  }

  if (tabMediaBtn) tabMediaBtn.addEventListener('click', () => switchSourceTab('media'));
  if (tabGenBtn) tabGenBtn.addEventListener('click', () => switchSourceTab('generators'));

  function syncGeneratorPanelClarity(isGenerativeMode) {
    const isTd = (activeEngine === 'td');
    const isActiveGen = !isTd && Boolean(isGenerativeMode);
    const shouldDim = !isActiveGen;
    if (moduleGen) {
      moduleGen.classList.toggle('module--dimmed', shouldDim);
    }
    if (webglGenSubpanel) {
      webglGenSubpanel.hidden = false;
      webglGenSubpanel.classList.toggle('module--dimmed', shouldDim);
    }
    if (genModuleTag) {
      genModuleTag.hidden = shouldDim;
    }
    if (genInactiveBanner) {
      genInactiveBanner.hidden = !shouldDim;
    }
    if (genInactiveNotice) {
      genInactiveNotice.textContent = isTd ? 'Modo TD activo' : 'Media activo';
    }
    if (btnGenerativeMode) {
      btnGenerativeMode.classList.toggle('active', isActiveGen);
      btnGenerativeMode.textContent = isActiveGen ? '⚡ Generador: ON' : '⚡ Generador: OFF';
    }
  }

  function updateSourceIndicator(type, label) {
    const isGen = (type === 'generator' || type === 'three');
    if (sourceLed) {
      sourceLed.className = 'status-led online';
    }
    if (sourceLabel) {
      sourceLabel.textContent = label;
    }
    syncGeneratorPanelClarity(isGen);
    if (typeof window.__syncCueSourceSelectFromCurrent === 'function') {
      window.__syncCueSourceSelectFromCurrent();
    }
  }

  function setActiveSampleThumb(activeId = null) {
    document.querySelectorAll('.sample-thumb-btn, .td-native-sample-btn, .td-palette-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-sample-id') === activeId);
    });
  }

  function clearThreeWorldActiveButtons() {
    document.querySelectorAll('[data-three-world]').forEach(btn => btn.classList.remove('active'));
  }

  function activateThreeWorld(worldIndex, silent = false) {
    const idx = Math.max(0, Math.min(3, parseInt(worldIndex, 10) || 0));
    const worldLabel = threeWorldNames[idx] || 'Aquarium 3D';
    if (activeEngine === 'td') {
      switchToWebGLMode();
    }
    if (isFrozen) {
      isFrozen = false;
      if (btnFreeze) btnFreeze.classList.remove('active');
      if (visualEngine) visualEngine.params.freeze = false;
    }
    stopCurrentVideo();
    setActiveSampleThumb(null);
    document.querySelectorAll('[data-gen]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[data-three-world]').forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-three-world'), 10) === idx);
    });

    currentSourceSnapshot = {
      kind: 'three',
      threeWorld: idx,
      genMode: 0,
      tdPaletteId: currentSourceSnapshot.tdPaletteId || 'td_pal_plasma',
      sampleId: null,
      sourceName: `3D: ${worldLabel}`
    };

    if (visualEngine) {
      visualEngine.setThreeWorld(idx);
      if (knobs['camOrbit']) visualEngine.setThreeCameraOrbit(knobs['camOrbit'].getNormalized());
      if (knobs['camZoom']) visualEngine.setThreeCameraZoom(knobs['camZoom'].getNormalized());
    }
    updateSourceIndicator('three', `Mundo 3D (${worldLabel})`);
    if (!silent) {
      showToast(`🎮 Mundo 3D activo: ${worldLabel} (WASD/Flechas · Q/E · R Reset)`, 'cyan');
    }
  }

  function activateGenerativeMode(silent = false) {
    if (activeEngine === 'td') {
      switchToWebGLMode();
    }
    if (isFrozen) {
      isFrozen = false;
      if (btnFreeze) btnFreeze.classList.remove('active');
      if (visualEngine) visualEngine.params.freeze = false;
    }
    stopCurrentVideo();
    setActiveSampleThumb(null);
    clearThreeWorldActiveButtons();
    const activeGenBtn = document.querySelector('[data-gen].active');
    const genMode = activeGenBtn ? parseInt(activeGenBtn.getAttribute('data-gen'), 10) : 0;
    const genLabel = genModeNames[genMode] || 'Fluid';
    currentSourceSnapshot = {
      kind: 'generator',
      genMode,
      tdPaletteId: currentSourceSnapshot.tdPaletteId || 'td_pal_reaction',
      sampleId: null,
      sourceName: `Gen: ${genLabel}`
    };
    if (visualEngine) {
      visualEngine.clearMedia();
      visualEngine.setParam('genMode', genMode);
    }
    updateSourceIndicator('generator', `Modo Generativo (${genLabel})`);
    if (midiBridge) {
      midiBridge.sendTdMedia({ source: '', mediaType: 'generator', mode: 'generative' });
    }
    if (!silent) showToast('🌀 Generador WebGL activo al 100%', 'cyan');
  }

  if (btnGenerativeMode) {
    btnGenerativeMode.addEventListener('click', () => activateGenerativeMode(false));
  }
  if (btnQuickActivateGen) {
    btnQuickActivateGen.addEventListener('click', () => activateGenerativeMode(false));
  }

  function deleteCustomMediaItem(sample, cardBtn) {
    if (!sample || !sample.id || PROTECTED_SAMPLE_IDS.has(sample.id)) return;
    const wasDisplayedOnCanvas = Boolean(
      currentSourceSnapshot &&
      (currentSourceSnapshot.sampleId === sample.id ||
        (sample.uploadPath && currentSourceSnapshot.serverPath === sample.uploadPath) ||
        (sample.file && currentSourceSnapshot.file === sample.file))
    );

    // 1. Remove from customMediaList & persist to localStorage
    const idx = customMediaList.findIndex(item => item.id === sample.id);
    if (idx !== -1) {
      customMediaList.splice(idx, 1);
    }
    markCustomMediaDeleted(sample.id);
    persistCustomMediaList();

    // 2. Remove card from DOM immediately
    if (cardBtn && cardBtn.parentNode) {
      cardBtn.remove();
    } else {
      renderSampleGrid();
    }

    // 3. Clean up any Show Scenes referencing this deleted custom image so it never resurrects on reload
    if (onCustomMediaDeletedFn) {
      onCustomMediaDeletedFn(sample.id);
    }

    // 4. If the deleted image was currently active on the canvas, switch automatically to default "Ciudad Cyber"
    if (wasDisplayedOnCanvas) {
      const defaultCity = sampleMediaList[0];
      if (defaultCity) {
        loadSampleImage(defaultCity, false);
      }
    }

    showToast(`🗑️ Imagen eliminada: ${sample.title}`, 'info');
  }

  function renderSampleGrid() {
    if (!sampleGrid) return;
    const activeId = currentSourceSnapshot && currentSourceSnapshot.sampleId;
    sampleGrid.innerHTML = '';
    const allItems = [...sampleMediaList, ...customMediaList];

    allItems.forEach(sample => {
      const isProtectedDefault = PROTECTED_SAMPLE_IDS.has(sample.id) && !sample.isCustom;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sample-thumb-btn${activeId === sample.id ? ' active' : ''}`;
      btn.setAttribute('data-sample-id', sample.id);
      btn.title = `Cargar ${sample.title} en el lienzo`;

      const img = document.createElement('img');
      img.src = sample.thumb || sample.dataUrl || sample.file || 'media/thumbs/city.jpg';
      img.alt = sample.title;

      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = sample.mediaType === 'video' ? `🎬 ${sample.title}` : sample.title;

      btn.appendChild(img);
      btn.appendChild(label);

      // Render delete button (×) ONLY on user-uploaded custom media (never on the 5 default images)
      if (!isProtectedDefault) {
        const delBtn = document.createElement('span');
        delBtn.className = 'delete-media-btn';
        delBtn.setAttribute('role', 'button');
        delBtn.setAttribute('tabindex', '0');
        delBtn.title = 'Eliminar imagen';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          deleteCustomMediaItem(sample, btn);
        });
        delBtn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            deleteCustomMediaItem(sample, btn);
          }
        });
        btn.appendChild(delBtn);
      }

      btn.addEventListener('click', () => loadSampleImage(sample));
      sampleGrid.appendChild(btn);
    });
  }

  // Populate initial sample gallery
  renderSampleGrid();

  // Populate TD Native HD Samples (Samples/Map)
  if (tdNativeSampleGrid) {
    tdNativeSampleGrid.innerHTML = '';
    tdNativeSamplesList.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'td-native-sample-btn';
      btn.setAttribute('data-sample-id', item.id);
      btn.title = `Cargar muestra nativa HD en TouchDesigner (${item.source})`;
      btn.textContent = item.label;

      btn.addEventListener('click', () => {
        stopCurrentVideo();
        setActiveSampleThumb(item.id);
        currentSourceSnapshot = { kind: 'td_sample', sampleId: item.id, genMode: currentSourceSnapshot.genMode, tdPaletteId: currentSourceSnapshot.tdPaletteId };
        updateSourceIndicator(item.mediaType, item.label);
        if (midiBridge) {
          midiBridge.sendTdMedia({
            source: item.source,
            mediaType: item.mediaType,
            mode: 'td_sample'
          });
        }
        showToast(
          activeEngine === 'td'
            ? `Muestra nativa TD activa: ${item.label}`
            : `Muestra TD enviada (${item.label}) — cambia a 🎥 TD para ver el stream`,
          'cyan'
        );
      });

      tdNativeSampleGrid.appendChild(btn);
    });
  }

  // Populate TD Palette Real-Time Procedural Generators
  if (tdPaletteGrid) {
    tdPaletteGrid.innerHTML = '';
    tdPaletteGeneratorsList.forEach(gen => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'td-palette-btn';
      btn.setAttribute('data-sample-id', gen.id);
      btn.title = `Activar generador procedural en tiempo real en TouchDesigner (${gen.source})`;
      btn.textContent = gen.label;

      btn.addEventListener('click', () => {
        stopCurrentVideo();
        setActiveSampleThumb(gen.id);
        currentSourceSnapshot = { kind: 'td_palette', tdPaletteId: gen.id, genMode: currentSourceSnapshot.genMode, sampleId: null };
        updateSourceIndicator('td_palette', `TD Gen: ${gen.label}`);
        if (midiBridge) {
          midiBridge.sendTdMedia({
            source: gen.source,
            mediaType: 'td_palette',
            mode: 'td_palette'
          });
        }
        showToast(`Generador TD Palette activo: ${gen.label}`, 'cyan');
      });

      tdPaletteGrid.appendChild(btn);
    });
  }

  function createVideoThumbnail(videoEl) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.72);
    } catch (e) {
      return null;
    }
  }

  function makeFallbackVideoThumbSvg(labelText) {
    const safe = String(labelText || 'VIDEO').replace(/[<>&"]/g, '').slice(0, 14);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#0d1726"/><text x="80" y="42" fill="#00e5ff" font-size="20" text-anchor="middle" font-family="monospace">🎬</text><text x="80" y="68" fill="#e2e8f0" font-size="11" text-anchor="middle" font-family="monospace">${safe}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  let onCustomMediaUpdatedFn = null;

  function loadSampleImage(sample, silent = false) {
    if (!sample) return;
    if (isFrozen) {
      isFrozen = false;
      if (btnFreeze) btnFreeze.classList.remove('active');
      if (visualEngine) visualEngine.params.freeze = false;
    }
    stopCurrentVideo();
    clearThreeWorldActiveButtons();
    setActiveSampleThumb(sample.id);
    const mediaType = sample.mediaType === 'video' ? 'video' : 'image';
    const nonBlobFile = (sample.file && !String(sample.file).startsWith('blob:')) ? sample.file : null;
    const mediaSrc = sample.dataUrl || sample.uploadPath || sample.serverPath || nonBlobFile || sample.src || sample.file;
    const tdSource = sample.uploadPath || sample.serverPath || nonBlobFile || sample.dataUrl || mediaSrc;

    currentSourceSnapshot = {
      kind: sample.isApiVideo ? 'api_video' : (sample.isCustom ? 'custom_media' : 'sample'),
      mode: 'media',
      isCustom: Boolean(sample.isCustom),
      isApiVideo: Boolean(sample.isApiVideo),
      sampleId: sample.id,
      name: sample.title || sample.fileName || 'Media',
      sourceName: sample.title || sample.fileName || 'Media',
      mediaType,
      src: mediaSrc,
      file: tdSource,
      serverPath: sample.uploadPath || sample.serverPath || (nonBlobFile && String(nonBlobFile).startsWith('/uploads') ? nonBlobFile : null),
      dataUrl: sample.dataUrl || null,
      thumb: sample.thumb || (mediaType === 'image' ? mediaSrc : null),
      theme: sample.theme || null,
      absolutePath: sample.absolutePath || null,
      genMode: currentSourceSnapshot.genMode,
      tdPaletteId: currentSourceSnapshot.tdPaletteId
    };

    if (activeEngine === 'td' && midiBridge && tdSource) {
      midiBridge.sendTdMedia({
        source: tdSource,
        mediaType,
        absolutePath: sample.absolutePath || undefined,
        mode: 'media'
      });
    }

    updateSourceIndicator(mediaType, `${mediaType === 'video' ? 'Video' : 'Foto'}: ${sample.title || sample.fileName}`);
    if (!silent) {
      showToast(
        activeEngine === 'td'
          ? `${mediaType === 'video' ? 'Video' : 'Imagen'} enviado a TD: ${sample.title || sample.fileName}`
          : `Cargado en motor WebGL: ${sample.title || sample.fileName}`,
        'cyan'
      );
    }

    if (activeEngine === 'td') {
      if (visualEngine) visualEngine.stop();
      if (glCanvas) glCanvas.style.display = 'none';
      return;
    }
    resetMediaFraming();

    if (mediaType === 'video') {
      const video = document.createElement('video');
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      let settled = false;
      let loadTimer = null;
      const activateFallbackStream = () => {
        if (settled) return;
        settled = true;
        if (loadTimer) clearTimeout(loadTimer);
        if (typeof window.__createFallbackApiVideoStream === 'function') {
          const fallbackVid = window.__createFallbackApiVideoStream(sample);
          if (fallbackVid) {
            currentVideoElement = fallbackVid;
            if (visualEngine) {
              visualEngine.setMedia(fallbackVid, 'video');
              visualEngine.params.useTexture = 1.0;
            }
            return true;
          }
        }
        return false;
      };
      if (sample.isApiVideo) {
        loadTimer = setTimeout(activateFallbackStream, 4500);
      }
      video.src = sample.file && String(sample.file).startsWith('blob:') ? sample.file : mediaSrc;
      video.onloadeddata = () => {
        if (settled) return;
        settled = true;
        if (loadTimer) clearTimeout(loadTimer);
        video.play().catch(() => { });
        currentVideoElement = video;
        if (visualEngine) {
          visualEngine.setMedia(video, 'video');
          visualEngine.params.useTexture = 1.0;
        }
      };
      video.onerror = () => {
        if (activateFallbackStream()) return;
        if (!silent) showToast(`No se pudo reproducir el video ${sample.title || sample.fileName}`, 'warn');
      };
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (visualEngine) {
        visualEngine.setMedia(img, 'image');
        visualEngine.params.useTexture = 1.0;
      }
    };
    img.onerror = () => {
      showToast(`No se pudo cargar la imagen ${sample.title || sample.fileName}`, 'warn');
    };
    img.src = mediaSrc;
  }

  async function registerCustomMediaFile(file, activateNow = true, sendUploadToTdNow = true) {
    if (!file) return null;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/i.test(file.name);

    if (!isImage && !isVideo) {
      showToast(`Formato no soportado (${file.name})`, 'warn');
      return null;
    }

    const mediaType = isVideo ? 'video' : 'image';
    const objectUrl = URL.createObjectURL(file);
    const cleanTitle = file.name.replace(/\.[^.]+$/, '') || file.name;
    const customItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: cleanTitle,
      fileName: file.name,
      mediaType,
      isCustom: true,
      file: objectUrl,
      src: objectUrl,
      thumb: isVideo ? makeFallbackVideoThumbSvg(cleanTitle) : objectUrl,
      dataUrl: null,
      uploadPath: null,
      serverPath: null,
      absolutePath: null
    };

    // Wait for base64 conversion on images BEFORE saving/activating so Cues always store real dataURL
    if (isImage) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (dataUrl) {
          customItem.dataUrl = dataUrl;
          customItem.src = dataUrl;
          customItem.thumb = dataUrl;
        }
      } catch (_) { }
    }

    customMediaList.push(customItem);
    persistCustomMediaList();
    renderSampleGrid();

    if (isVideo) {
      const probe = document.createElement('video');
      probe.muted = true;
      probe.playsInline = true;
      probe.src = objectUrl;
      probe.onloadeddata = () => {
        probe.currentTime = Math.min(0.25, probe.duration || 0);
      };
      probe.onseeked = () => {
        const poster = createVideoThumbnail(probe);
        if (poster) {
          customItem.thumb = poster;
          if (currentSourceSnapshot && currentSourceSnapshot.sampleId === customItem.id) {
            currentSourceSnapshot.thumb = poster;
          }
          persistCustomMediaList();
          if (onCustomMediaUpdatedFn) onCustomMediaUpdatedFn(customItem);
          renderSampleGrid();
        }
        probe.src = '';
      };
    }

    // Upload real file to server.js -> /uploads/ and preserve path for TD and Cues
    const uploadPromise = uploadFileForTouchDesigner(file, mediaType, sendUploadToTdNow).then(uploaded => {
      if (uploaded) {
        customItem.uploadPath = uploaded.publicPath;
        customItem.serverPath = uploaded.publicPath;
        customItem.absolutePath = uploaded.absolutePath;
        customItem.file = uploaded.publicPath || customItem.file;
        if (!customItem.dataUrl) customItem.src = uploaded.publicPath;
        if (currentSourceSnapshot && currentSourceSnapshot.sampleId === customItem.id) {
          currentSourceSnapshot.file = uploaded.publicPath;
          currentSourceSnapshot.serverPath = uploaded.publicPath;
          currentSourceSnapshot.absolutePath = uploaded.absolutePath;
        }
        persistCustomMediaList();
        if (onCustomMediaUpdatedFn) onCustomMediaUpdatedFn(customItem);
        renderSampleGrid();
      }
      return customItem;
    });

    if (activateNow) {
      loadSampleImage(customItem, false);
    }

    // Return item once uploaded if small, or immediately with dataUrl ready while serverPath patches asynchronously
    return { customItem, uploadPromise };
  }

  async function handleFileSelection(filesOrFile) {
    if (!filesOrFile) return;
    const files = (filesOrFile instanceof File) ? [filesOrFile] : Array.from(filesOrFile);
    if (!files.length) return;
    // Add every uploaded file to MEDIOS Y MUESTRAS gallery; activate the last valid one on canvas
    const valid = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg|mp4|webm|mov|m4v)$/i.test(f.name)
    );
    if (!valid.length) {
      showToast('Formato no soportado (usa imagen o video)', 'warn');
      return;
    }
    for (let idx = 0; idx < valid.length; idx++) {
      await registerCustomMediaFile(valid[idx], idx === valid.length - 1, idx === valid.length - 1);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function uploadFileForTouchDesigner(file, mediaType, sendToTdNow = true) {
    try {
      const activateParam = sendToTdNow ? 'true' : 'false';
      const res = await fetch(`${API_BASE}/api/upload?activate=${activateParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
          'X-Upload-Activate': activateParam
        },
        body: file
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !data.success) throw new Error((data && data.error) || 'Upload failed');

      const publicPath = data.publicPath || data.url || `/uploads/${data.filename}`;
      const absolutePath = data.absolutePath || data.filePath;
      if (activeEngine === 'td' && sendToTdNow && midiBridge) {
        midiBridge.sendTdMedia({
          source: publicPath,
          mediaType: data.mediaType || mediaType,
          absolutePath: absolutePath,
          mode: 'media'
        });
      }
      if (activeEngine === 'td') {
        showToast(`Guardado en galería + TD: ${file.name}`, 'cyan', 1800);
      }
      return { publicPath, absolutePath };
    } catch (err) {
      if (activeEngine === 'td') {
        console.warn('[Upload] POST /api/upload falló, enviando base64 por WebSocket:', err);
        try {
          const dataUrl = await readFileAsDataUrl(file);
          if (sendToTdNow && midiBridge) {
            midiBridge.sendTdMedia({ source: dataUrl, mediaType: mediaType, mode: 'media' });
          }
        } catch (e2) {
          showToast('No se pudo enviar el archivo a TouchDesigner', 'warn');
        }
      }
      return null;
    }
  }

  let currentWebcamStream = null;
  let isWebcamActive = false;

  function stopWebcam() {
    const wasActive = isWebcamActive || Boolean(currentWebcamStream) ||
      Boolean(currentVideoElement && currentVideoElement.srcObject) ||
      Boolean(visualEngine && visualEngine.media && visualEngine.media.type === 'camera');

    if (currentWebcamStream) {
      try {
        currentWebcamStream.getTracks().forEach(track => track.stop());
      } catch (e) { }
      currentWebcamStream = null;
    }
    if (currentVideoElement && currentVideoElement.srcObject) {
      try {
        currentVideoElement.pause();
        currentVideoElement.srcObject.getTracks().forEach(track => track.stop());
        currentVideoElement.srcObject = null;
      } catch (e) { }
      currentVideoElement = null;
    }
    isWebcamActive = false;
    if (btnCamera) btnCamera.classList.remove('active');
    if (wasActive && visualEngine && visualEngine.media && visualEngine.media.type === 'camera') {
      visualEngine.clearMedia();
    }
  }

  function stopCurrentVideo() {
    stopWebcam();
    if (currentVideoElement) {
      try {
        if (typeof currentVideoElement._cleanupFallback === 'function') {
          currentVideoElement._cleanupFallback();
        }
        currentVideoElement.pause();
        if (currentVideoElement.srcObject) {
          currentVideoElement.srcObject.getTracks().forEach(track => track.stop());
        }
        currentVideoElement.src = '';
      } catch (e) { }
      currentVideoElement = null;
    }
  }

  // File Upload Button (single or multiple images/videos)
  if (btnUpload && fileInput) {
    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length) {
        handleFileSelection(e.target.files);
        fileInput.value = '';
      }
    });
  }

  // Webcam Button (toggle on/off)
  if (btnCamera) {
    btnCamera.addEventListener('click', async () => {
      if (isWebcamActive) {
        stopWebcam();
        activateGenerativeMode(true);
        showToast('Cámara web desactivada');
        return;
      }
      stopCurrentVideo();
      setActiveSampleThumb(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        currentWebcamStream = stream;
        isWebcamActive = true;
        btnCamera.classList.add('active');

        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;

        video.onloadedmetadata = () => {
          video.play().catch(() => { });
          currentVideoElement = video;
          if (visualEngine) {
            visualEngine.setMedia(video, 'camera');
          }
          updateSourceIndicator('camera', 'Cámara Web en vivo');
          if (activeEngine === 'td' && midiBridge) {
            midiBridge.sendTdMedia({ source: 'webcam_live', mediaType: 'camera' });
          }
          showToast('Cámara web activa en lienzo', 'cyan');
        };
      } catch (err) {
        stopWebcam();
        console.warn('Acceso a cámara denegado o no disponible:', err);
        showToast('No se pudo acceder a la cámara web', 'warn');
      }
    });
  }

  // Video Transport (also routed to TouchDesigner as td_trigger)
  let mediaPausedState = false;
  let mediaLoopState = true;
  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      if (currentVideoElement) {
        if (currentVideoElement.paused) {
          currentVideoElement.play();
        } else {
          currentVideoElement.pause();
        }
        mediaPausedState = currentVideoElement.paused;
      } else {
        mediaPausedState = !mediaPausedState;
      }
      btnPlayPause.textContent = mediaPausedState ? '▶ Play' : '⏸ Pausa';
      emitTdTriggerForButton(btnPlayPause, mediaPausedState, mediaPausedState ? 1 : 0);
    });
  }

  function applyMediaFraming() {
    const x = mediaOffsetX ? parseFloat(mediaOffsetX.value) || 0 : 0;
    const y = mediaOffsetY ? parseFloat(mediaOffsetY.value) || 0 : 0;
    const zoom = mediaZoom ? parseFloat(mediaZoom.value) || 1 : 1;
    if (visualEngine && typeof visualEngine.setMediaTransform === 'function') {
      visualEngine.setMediaTransform(x, y, zoom);
    }
  }

  function resetMediaFraming() {
    if (mediaOffsetX) mediaOffsetX.value = '0';
    if (mediaOffsetY) mediaOffsetY.value = '0';
    if (mediaZoom) mediaZoom.value = '1';
    applyMediaFraming();
  }

  [mediaOffsetX, mediaOffsetY, mediaZoom].forEach(slider => {
    if (slider) {
      slider.addEventListener('input', applyMediaFraming);
    }
  });
  if (btnResetMediaFraming) {
    btnResetMediaFraming.addEventListener('click', resetMediaFraming);
  }

  if (btnLoop) {
    btnLoop.addEventListener('click', () => {
      if (currentVideoElement) {
        currentVideoElement.loop = !currentVideoElement.loop;
        mediaLoopState = currentVideoElement.loop;
      } else {
        mediaLoopState = !mediaLoopState;
      }
      btnLoop.classList.toggle('active', mediaLoopState);
      emitTdTriggerForButton(btnLoop, mediaLoopState, mediaLoopState ? 1 : 0);
    });
  }

  // Collapse / Minimize Buttons across ALL 6 Panels (00 Source, 0A Audio, 01 Gen, 02 Mod, 03 Color, 04 Show)
  document.querySelectorAll('.panel-collapse-btn[data-collapse-panel]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panelId = btn.getAttribute('data-collapse-panel');
      const panel = panelId ? document.getElementById(panelId) : btn.closest('.workstation-panel, .rack-module');
      if (!panel) return;
      const collapsed = panel.classList.toggle('is-collapsed');
      if (panelId === 'mediaBay') {
        panel.classList.toggle('collapsed', collapsed);
      }
      btn.textContent = collapsed ? '▸' : '▾';
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.title = collapsed ? 'Expandir panel' : 'Minimizar panel';
    });
  });

  // Drag and Drop Handling
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput && fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFileSelection(e.dataTransfer.files);
      }
    });
  }

  let dragCounter = 0;
  function isDraggingOverCuePad(e) {
    return Boolean(e.target && e.target.closest && e.target.closest('#moduleShow, .seq-scene-pad, .drop-zone'));
  }

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dropOverlay) {
      if (isDraggingOverCuePad(e)) {
        dropOverlay.classList.remove('active');
      } else {
        dropOverlay.classList.add('active');
      }
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 && dropOverlay) {
      dropOverlay.classList.remove('active');
      dragCounter = 0;
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropOverlay && isDraggingOverCuePad(e)) {
      dropOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dropOverlay) dropOverlay.classList.remove('active');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFileSelection(e.dataTransfer.files);
    }
  });

  // --- Engine Mode Selector & TouchDesigner Custom Deck (Points 2, 3 & 4) ---
  function ensureAudioContinuity(wasTrackPlaying = false) {
    if (!visualEngine || !visualEngine.audio) return;
    const a = visualEngine.audio;
    try {
      if (a.context && a.context.state === 'suspended') {
        a.context.resume().catch(() => { });
      }
    } catch (e) { }
    const trackEl = globalAudioEl || a.element;
    if (trackEl && trackEl.src && (wasTrackPlaying || (!trackEl.paused && !trackEl.ended))) {
      routeTrackSourceToAnalyserAndSpeakers();
      if (trackEl.paused && !trackEl.ended) {
        trackEl.play().catch(() => { });
      }
      a.mode = 'file';
      a.active = true;
    }
  }

  function syncEngineModeUI(isTdMode) {
    document.body.classList.toggle('td-mode-active', isTdMode);
    document.body.classList.toggle('td-deck-mode', isTdMode);

    if (moduleGen) moduleGen.hidden = isTdMode;
    if (btnGenerativeMode) btnGenerativeMode.hidden = isTdMode;
    if (btnCamera) btnCamera.hidden = isTdMode;
    if (btnUpload) {
      btnUpload.textContent = isTdMode ? '📁 Subir Archivo TD' : '📁 Subir Imagen / Video';
    }

    if (tdInspectorBar) tdInspectorBar.hidden = !isTdMode;
    if (tdNativeLibrarySection) tdNativeLibrarySection.hidden = !isTdMode;
    if (tdPaletteLibrarySection) tdPaletteLibrarySection.hidden = !isTdMode;
    if (tdMediaBadgePill) tdMediaBadgePill.hidden = !isTdMode;
    if (localLibraryLabel) {
      localLibraryLabel.textContent = isTdMode ? 'BIBLIOTECA MEDIA HD' : 'Medios y Muestras';
    }
    if (fxKnobsTag) fxKnobsTag.textContent = isTdMode ? 'TOP · DISPLACE' : 'DISPLACE · KALEIDO';
    if (moduleShowBadge) moduleShowBadge.textContent = isTdMode ? '[03 · TEMPO]' : '[04 · SEQUENCER]';
    if (moduleTitleShow) moduleTitleShow.textContent = isTdMode ? '3. MASTER / LFO SYNC' : 'SHOW';
    if (fxModuleTag) fxModuleTag.textContent = isTdMode ? 'CHOP · CLOCK' : 'CLOCK · 8 SCENES';

    // When entering TD mode, automatically stop Auto-Show & Show Sequencer so it never blacks out TD
    if (isTdMode) {
      if (autoShowEnabled) {
        autoShowEnabled = false;
        autoShowEnergy = 0;
        if (btnAutoShow) {
          btnAutoShow.classList.remove('active');
          btnAutoShow.setAttribute('aria-pressed', 'false');
        }
      }
      if (seqPlaying) {
        seqPlaying = false;
        seqBeatAccumulator = 0;
        seqSecondAccumulator = 0;
        if (updateCueProgressBarFn) updateCueProgressBarFn(-1, 0);
        if (btnSeqPlay) {
          btnSeqPlay.classList.remove('active');
          btnSeqPlay.textContent = '▶ Seq';
        }
      }
    }

    syncGeneratorPanelClarity(!isTdMode && (!visualEngine || visualEngine.sourceMode !== 'media'));
  }

  // Ensure initial boot state strictly starts in clean WebGL mode
  syncEngineModeUI(false);

  let isInverted = false;

  function sendCleanTdInitialSync() {
    pulseEnabled = false;
    isInverted = false;
    if (visualEngine) {
      visualEngine.pulseActive = false;
      visualEngine.params.invert = false;
      visualEngine.params.monochrome = false;
    }
    if (btnPulseToggle) {
      btnPulseToggle.classList.remove('active');
      btnPulseToggle.textContent = '⚡ Pulse: OFF';
    }
    if (btnInvert) {
      btnInvert.classList.remove('active');
    }
    document.querySelectorAll('[data-col]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-col') === 'original');
    });
    if (midiBridge) {
      midiBridge.sendTdTrigger({ id: 'pulse', action: 'pulse', state: false, value: 0 });
      midiBridge.sendTdTrigger({ id: 'flash', action: 'flash', state: false, value: 0 });
      midiBridge.sendTdTrigger({ id: 'invert', action: 'invert', state: false, value: 0 });
      midiBridge.sendTdTrigger({ id: 'color_original', action: 'color_original', state: true, value: 1 });
    }
  }

  function switchToWebGLMode() {
    const trackEl = globalAudioEl || (visualEngine && visualEngine.audio && visualEngine.audio.element);
    const wasTrackPlaying = Boolean(trackEl && trackEl.src && !trackEl.paused && !trackEl.ended);

    activeEngine = 'webgl';
    resetTdFrameState();
    tdHasIncomingVideoFrame = false;
    syncEngineModeUI(false);
    if (btnEngineWebGL) btnEngineWebGL.classList.add('active');
    if (btnEngineTD) btnEngineTD.classList.remove('active');
    if (tdInspectorBar) tdInspectorBar.hidden = true;
    if (tdDeckCanvas) tdDeckCanvas.hidden = true;
    if (tdLiveImage) tdLiveImage.classList.remove('active');
    if (glCanvas) glCanvas.style.display = 'block';
    if (engineLabel) engineLabel.textContent = 'WebGL Standalone';
    if (engineLed) engineLed.className = 'status-led online';
    if (tdModal) tdModal.hidden = true;
    if (visualEngine) {
      visualEngine.start();
      syncGeneratorPanelClarity(visualEngine.sourceMode !== 'media');
    }

    // Keep track and live audio uninterrupted across engine switches
    ensureAudioContinuity(wasTrackPlaying);
  }

  function enterTouchDesignerCustomDeck(withVideoStream = false) {
    const trackEl = globalAudioEl || (visualEngine && visualEngine.audio && visualEngine.audio.element);
    const wasTrackPlaying = Boolean(trackEl && trackEl.src && !trackEl.paused && !trackEl.ended);

    activeEngine = 'td';
    resetTdFrameState();
    syncEngineModeUI(true);

    // Pause WebGL shader loop and hide canvas so it never consumes GPU/CPU or flickers behind TD frames
    if (visualEngine) visualEngine.stop();
    if (glCanvas) glCanvas.style.display = 'none';

    if (btnEngineTD) btnEngineTD.classList.add('active');
    if (btnEngineWebGL) btnEngineWebGL.classList.remove('active');
    if (tdInspectorBar) tdInspectorBar.hidden = false;
    if (tdModal) tdModal.hidden = true;
    if (engineLabel) engineLabel.textContent = 'TD LIVE CONTROLLER MODE';
    if (engineLed) engineLed.className = 'status-led online';
    if (fpsReadout) fpsReadout.textContent = 'TX LIVE';

    if (withVideoStream && tdLiveImage) {
      tdHasIncomingVideoFrame = true;
      tdLiveImage.classList.add('active');
      tdLiveImage.src = `${API_BASE}/api/stream?t=${Date.now()}`;
      if (tdDeckCanvas) tdDeckCanvas.hidden = true;
    } else {
      tdHasIncomingVideoFrame = false;
      if (tdLiveImage) tdLiveImage.classList.remove('active');
      if (tdDeckCanvas) tdDeckCanvas.hidden = false;
    }

    // Force Pulse OFF, Flash OFF, and Invert OFF immediately on entering TD mode
    sendCleanTdInitialSync();

    // Broadcast current snapshot of active TD knobs (excluding hidden panel 1 generator knobs)
    knobList.forEach(k => {
      if (k.category === 'gen') return;
      midiBridge.sendTdControl({
        id: k.id,
        channel: k.channelName || k.label,
        cc: k.cc,
        value: k.getNormalized(),
        scaledValue: k.value
      });
    });

    // Keep track and live audio uninterrupted across engine switches
    ensureAudioContinuity(wasTrackPlaying);

    showToast('🟠 Consola TouchDesigner (TD Custom Deck) Activa', 'cyan');
  }

  async function checkTouchDesignerConnection() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1600);
      const res = await fetch(`${API_BASE}/api/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data && (data.tdConnected || data.connected));
    } catch (e) {
      return false;
    }
  }

  async function openTouchDesignerModal() {
    if (tdModal) tdModal.hidden = false;
    if (tdModalFeedback) {
      tdModalFeedback.hidden = true;
      tdModalFeedback.textContent = '';
    }
    if (tdModalStatusPill) {
      tdModalStatusPill.textContent = 'Verificando...';
      tdModalStatusPill.classList.remove('online');
    }
    if (tdModalLed) tdModalLed.className = 'status-led warn';

    const isTdStreamOnline = await checkTouchDesignerConnection();
    if (isTdStreamOnline) {
      if (tdModalStatusPill) {
        tdModalStatusPill.textContent = 'TD Detectado Online';
        tdModalStatusPill.classList.add('online');
      }
      if (tdModalLed) tdModalLed.className = 'status-led online';
      enterTouchDesignerCustomDeck(true);
    } else {
      if (tdModalStatusPill) {
        tdModalStatusPill.textContent = 'Consola Lista (WS :8080)';
        tdModalStatusPill.classList.add('online');
      }
      if (tdModalLed) tdModalLed.className = 'status-led online';
    }
  }

  if (btnEngineWebGL) {
    btnEngineWebGL.addEventListener('click', () => {
      switchToWebGLMode();
      showToast('Motor WebGL Autónomo Activo');
    });
  }

  if (btnEngineTD) {
    btnEngineTD.addEventListener('click', () => {
      if (activeEngine === 'td') {
        openTouchDesignerModal();
        return;
      }
      if (btnEngineTD) btnEngineTD.classList.add('active');
      if (btnEngineWebGL) btnEngineWebGL.classList.remove('active');
      openTouchDesignerModal();
    });
  }

  if (btnOpenTdGuide) {
    btnOpenTdGuide.addEventListener('click', () => {
      if (tdModal) tdModal.hidden = false;
    });
  }

  // Apply Custom WebSocket URL inside TD Modal
  if (btnTdApplyWs && tdModalWsInput) {
    btnTdApplyWs.addEventListener('click', () => {
      const customUrl = tdModalWsInput.value.trim();
      if (customUrl) {
        localStorage.setItem('vortex_td_ws_url', customUrl);
        if (wsUrlInput) wsUrlInput.value = customUrl;
        midiBridge.connectWebSocket(customUrl);
        showToast(`Conectando puente TD a ${customUrl}`, 'cyan');
      }
    });
  }

  // Point 4: Primary button "Ya abrí mi archivo en TouchDesigner -> Ir a la Consola TD"
  if (btnTdEnterDeck) {
    btnTdEnterDeck.addEventListener('click', () => {
      if (tdModalWsInput && tdModalWsInput.value.trim()) {
        const url = tdModalWsInput.value.trim();
        localStorage.setItem('vortex_td_ws_url', url);
        if (wsUrlInput) wsUrlInput.value = url;
        midiBridge.connectWebSocket(url);
      }
      enterTouchDesignerCustomDeck(false);
    });
  }

  if (btnTdRetry) {
    btnTdRetry.addEventListener('click', async () => {
      btnTdRetry.textContent = '⏳ Verificando stream...';
      const ok = await checkTouchDesignerConnection();
      btnTdRetry.textContent = '🔄 Verificar stream de video TD';
      if (ok) {
        enterTouchDesignerCustomDeck(true);
      } else {
        if (tdModalFeedback) {
          tdModalFeedback.hidden = false;
          tdModalFeedback.style.borderColor = 'rgba(0, 229, 255, 0.45)';
          tdModalFeedback.style.color = '#00e5ff';
          tdModalFeedback.textContent =
            'ℹ️ Stream de video HTTP no detectado, pero el puente WebSocket está activo. Haz clic en "🎛️ Ya abrí mi archivo en TouchDesigner → Ir a la Consola TD" para usar todas las perillas y MIDI en vivo.';
        }
      }
    });
  }

  if (btnTdCancelToWebGL) {
    btnTdCancelToWebGL.addEventListener('click', () => {
      switchToWebGLMode();
      showToast('Modo WebGL Autónomo activo', 'cyan');
    });
  }

  // Toggle Continuous Audio FFT & BPM Stream to TouchDesigner
  if (btnTdAudioStream) {
    btnTdAudioStream.addEventListener('click', async () => {
      tdStreamAudioEnabled = !tdStreamAudioEnabled;
      btnTdAudioStream.classList.toggle('active', tdStreamAudioEnabled);
      btnTdAudioStream.textContent = tdStreamAudioEnabled
        ? '⚡ Enviar Audio FFT y BPM a TD: ON'
        : '⚡ Enviar Audio FFT y BPM a TD: OFF';

      // Ensure audio analyzer is running if user enables FFT stream (without interrupting local track playback)
      const isTrackPlaying = Boolean(globalAudioEl && globalAudioEl.src && !globalAudioEl.paused && !globalAudioEl.ended);
      if (tdStreamAudioEnabled && visualEngine && !visualEngine.audio.active && !isTrackPlaying && visualEngine.audio.mode !== 'file') {
        try {
          const selectedId = audioDeviceSelect ? audioDeviceSelect.value : '';
          const micOn = await visualEngine.startDeviceAudio(selectedId);
          if (btnAudioMic) btnAudioMic.classList.toggle('active', micOn);
          if (audioLed) audioLed.className = micOn ? 'status-led online' : 'status-led';
          syncAudioHudState({ active: micOn, mode: micOn ? 'device' : 'none' });
          await populateAudioDevices();
        } catch (e) { }
      } else if (isTrackPlaying) {
        ensureAudioContinuity(true);
      }

      showToast(
        tdStreamAudioEnabled
          ? 'Transmitiendo Audio FFT (bass, mid, treble) y BPM a TouchDesigner'
          : 'Transmisión de Audio FFT a TD pausada',
        tdStreamAudioEnabled ? 'cyan' : 'info'
      );
    });
  }

  // --- Audio Engine: Dual Selector (Local File + Live Input Devices via enumerateDevices) ---
  async function populateAudioDevices() {
    if (!audioDeviceSelect || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter(d => d.kind === 'audioinput');
      const prevValue = (visualEngine && visualEngine.audio.deviceId) || audioDeviceSelect.value || '';

      audioDeviceSelect.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '🎛️ Entrada por defecto';
      audioDeviceSelect.appendChild(defaultOpt);

      inputs.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Entrada Audio #${idx + 1}`;
        audioDeviceSelect.appendChild(opt);
      });

      if (prevValue && inputs.some(d => d.deviceId === prevValue)) {
        audioDeviceSelect.value = prevValue;
      }
    } catch (e) {
      console.warn('[Vortex] Error enumerando dispositivos de audio:', e);
    }
  }

  populateAudioDevices();
  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
    navigator.mediaDevices.addEventListener('devicechange', populateAudioDevices);
  }

  let globalAudioEl = null;
  let globalTrackSourceNode = null;
  let trackSourceConnected = false;
  let trackAudioEventsWired = false;

  function ensureMasterAudioRouting() {
    if (!visualEngine) return null;
    const a = visualEngine._ensureAudioGraph();
    if (!a || !a.context) return a;
    if (!a.analyser) {
      a.analyser = a.context.createAnalyser();
      a.analyser.fftSize = 1024;
      a.analyser.smoothingTimeConstant = 0.72;
      a.data = new Uint8Array(a.analyser.frequencyBinCount);
    }
    if (!a.masterGain) {
      a.masterGain = a.context.createGain();
    }
    a.masterGain.gain.setValueAtTime(1.0, a.context.currentTime);
    if (!a._masterDestWired) {
      a.masterGain.connect(a.context.destination);
      a._masterDestWired = true;
    }
    if (!a.monitorGain) {
      a.monitorGain = a.context.createGain();
      a.monitorGain.gain.setValueAtTime(a.thruEnabled ? 1.0 : 0.0, a.context.currentTime);
    }
    if (!a._monitorMasterWired) {
      a.monitorGain.connect(a.masterGain);
      a._monitorMasterWired = true;
    }
    return a;
  }

  function ensureGlobalTrackPlayer() {
    if (!visualEngine) return null;
    const a = ensureMasterAudioRouting();
    if (!a || !a.context) return null;
    if (!globalAudioEl) {
      globalAudioEl = a.element || new Audio();
      globalAudioEl.crossOrigin = 'anonymous';
      globalAudioEl.preload = 'auto';
      globalAudioEl.loop = true;
      a.element = globalAudioEl;
    }
    globalAudioEl.muted = false;
    globalAudioEl.volume = 1.0;
    if (!globalTrackSourceNode) {
      // Create MediaElementAudioSourceNode strictly ONCE for the lifetime of globalAudioEl
      globalTrackSourceNode = a.mediaSource || a.context.createMediaElementSource(globalAudioEl);
      a.mediaSource = globalTrackSourceNode;
    }
    if (!trackAudioEventsWired && globalAudioEl) {
      trackAudioEventsWired = true;
      globalAudioEl.addEventListener('play', () => {
        if (visualEngine && visualEngine.audio.mode === 'file') {
          visualEngine.audio.active = true;
          syncAudioHudState({ active: true, mode: 'file' });
        }
      });
      globalAudioEl.addEventListener('pause', () => {
        if (visualEngine && visualEngine.audio.mode === 'file') {
          visualEngine.audio.active = false;
          visualEngine.audio.bass = visualEngine.audio.mid = visualEngine.audio.treble = 0;
          syncAudioHudState({ active: false, mode: 'file' });
        }
      });
      globalAudioEl.addEventListener('ended', () => {
        if (!globalAudioEl.loop && visualEngine && visualEngine.audio.mode === 'file') {
          visualEngine.audio.active = false;
          visualEngine.audio.bass = visualEngine.audio.mid = visualEngine.audio.treble = 0;
          syncAudioHudState({ active: false, mode: 'file' });
        }
      });
    }
    return a;
  }

  function routeTrackSourceToAnalyserAndSpeakers() {
    if (!visualEngine) return;
    const a = ensureGlobalTrackPlayer();
    if (!a || !globalTrackSourceNode) return;
    if (!trackSourceConnected && !a._mediaSourceWired) {
      // Connect local track audio PERMANENTLY to AnalyserNode (FFT) AND MasterGainNode -> destination (NEVER disconnect)
      globalTrackSourceNode.connect(a.analyser);
      globalTrackSourceNode.connect(a.masterGain || a.context.destination);
      trackSourceConnected = true;
      a._mediaSourceWired = true;
    }
  }

  function stopLiveAudioStreamOnly() {
    if (!visualEngine) return;
    const a = visualEngine.audio;
    try {
      if (a.stream) {
        a.stream.getTracks().forEach(t => t.stop());
        a.stream = null;
      }
    } catch (e) { }
    try {
      if (a.streamSource) {
        a.streamSource.disconnect();
        a.streamSource = null;
      }
    } catch (e) { }
    if (a.mode === 'device') {
      a.mode = 'none';
      a.active = false;
      a.bass = a.mid = a.treble = 0;
    }
    if (btnAudioMic) {
      btnAudioMic.classList.remove('active');
      btnAudioMic.textContent = '🎙️ Activar Entrada Live';
    }
  }

  function syncAudioHudState({ active, mode }) {
    const isLiveDeviceActive = Boolean(active && mode === 'device');
    if (btnAudioMic) {
      btnAudioMic.classList.toggle('active', isLiveDeviceActive);
      btnAudioMic.textContent = isLiveDeviceActive ? '🎙️ Entrada Live: ON' : '🎙️ Activar Entrada Live';
    }
    if (btnLoadAudio) btnLoadAudio.classList.toggle('active', active && mode === 'file');
    if (audioLed) audioLed.className = active ? 'status-led online' : 'status-led';

    const trackEl = globalAudioEl || (visualEngine && visualEngine.audio.element);
    const hasFile = Boolean(trackEl && trackEl.src);
    const isFilePlaying = Boolean(hasFile && !trackEl.paused && !trackEl.ended);
    if (audioEngineModeBadge) {
      if (active && mode === 'file' && isFilePlaying) {
        audioEngineModeBadge.textContent = '🟢 Motor Interno Digital Activo (WAV/MP3)';
        audioEngineModeBadge.style.color = '#34d399';
        audioEngineModeBadge.style.borderColor = 'rgba(16, 185, 129, 0.55)';
        audioEngineModeBadge.style.background = 'rgba(6, 78, 59, 0.55)';
      } else if (isLiveDeviceActive) {
        audioEngineModeBadge.textContent = '🎙️ Entrada Live Activa';
        audioEngineModeBadge.style.color = '#38bdf8';
        audioEngineModeBadge.style.borderColor = 'rgba(56, 189, 248, 0.55)';
        audioEngineModeBadge.style.background = 'rgba(12, 74, 110, 0.55)';
      } else if (mode === 'file' && hasFile && !isFilePlaying) {
        audioEngineModeBadge.textContent = '⏸️ Pista Local en Pausa';
        audioEngineModeBadge.style.color = '#fbbf24';
        audioEngineModeBadge.style.borderColor = 'rgba(245, 158, 11, 0.45)';
        audioEngineModeBadge.style.background = 'rgba(120, 53, 15, 0.35)';
      } else {
        audioEngineModeBadge.textContent = '⚪ Motor en Espera';
        audioEngineModeBadge.style.color = '#94a3b8';
        audioEngineModeBadge.style.borderColor = 'rgba(148, 163, 184, 0.3)';
        audioEngineModeBadge.style.background = 'rgba(15, 23, 42, 0.85)';
      }
    }
    if (audioMiniPlayer) audioMiniPlayer.hidden = false;
    if (btnAudioPlayPause) {
      btnAudioPlayPause.disabled = !hasFile;
      if (hasFile) {
        const isPlaying = !trackEl.paused && !trackEl.ended;
        btnAudioPlayPause.textContent = isPlaying ? '⏸' : '▶';
        btnAudioPlayPause.classList.toggle('active', isPlaying);
      } else {
        btnAudioPlayPause.textContent = '▶';
        btnAudioPlayPause.classList.remove('active');
      }
    }
    if (btnAudioLoop) {
      btnAudioLoop.disabled = !hasFile;
      if (hasFile) {
        btnAudioLoop.classList.toggle('active', Boolean(trackEl.loop));
      }
    }
    if (audioTrackName) {
      const label = hasFile ? ((visualEngine && visualEngine.audio.fileName) || 'Pista Local') : 'Sin pista cargada';
      audioTrackName.textContent = label;
      audioTrackName.title = label;
    }
  }

  // Audio -> FX Matrix Quick Routing Toggles
  [
    { el: btnMatrixBass, key: 'bass', label: 'Bajos -> Deformar' },
    { el: btnMatrixMid, key: 'mid', label: 'Medios -> Color' },
    { el: btnMatrixTreble, key: 'treble', label: 'Agudos -> Caleido' }
  ].forEach(({ el, key, label }) => {
    if (!el) return;
    el.addEventListener('click', () => {
      audioMatrix[key] = !audioMatrix[key];
      el.classList.toggle('active', audioMatrix[key]);
      showToast(`${label}: ${audioMatrix[key] ? 'ON' : 'OFF'}`);
    });
  });

  if (btnAudioLoop) {
    btnAudioLoop.addEventListener('click', () => {
      const trackEl = globalAudioEl || (visualEngine && visualEngine.audio.element);
      if (!trackEl) return;
      trackEl.loop = !trackEl.loop;
      btnAudioLoop.classList.toggle('active', trackEl.loop);
      showToast(`Loop de pista: ${trackEl.loop ? 'ON' : 'OFF'}`);
    });
  }

  function isVirtualAudioBridge(label) {
    return /bridge|pro\s*tools|blackhole|loopback|soundflower/i.test(String(label || ''));
  }

  function syncAudioThruState(enabled, notify = false) {
    const activeThru = visualEngine ? visualEngine.setMonitorThru(enabled) : Boolean(enabled);
    if (btnAudioThru) {
      btnAudioThru.classList.toggle('active', activeThru);
      btnAudioThru.setAttribute('aria-pressed', String(activeThru));
      btnAudioThru.textContent = activeThru ? '🔊 Thru: ON' : '🔊 Monitorear Audio (Thru)';
    }
    if (notify) {
      showToast(
        activeThru
          ? '🔊 Audio Thru activo: escuchando entrada Live por bocinas/audífonos'
          : '🔇 Audio Thru silenciado (solo análisis FFT)',
        activeThru ? 'cyan' : 'info'
      );
    }
    return activeThru;
  }

  if (btnAudioThru) {
    btnAudioThru.addEventListener('click', () => {
      const next = !(visualEngine && visualEngine.audio.thruEnabled);
      syncAudioThruState(next, true);
    });
  }

  // Live audio toggle button
  if (btnAudioMic) {
    btnAudioMic.addEventListener('click', async () => {
      if (!visualEngine) return;
      try {
        if (visualEngine.audio.active && visualEngine.audio.mode === 'device') {
          stopLiveAudioStreamOnly();
          syncAudioHudState({ active: false, mode: 'none' });
          showToast('Entrada Live desactivada');
        } else {
          if (globalAudioEl && !globalAudioEl.paused) {
            globalAudioEl.pause();
          }
          const aLive = ensureMasterAudioRouting();
          if (aLive && aLive.context && aLive.context.state !== 'running') {
            await aLive.context.resume();
          }
          const selectedId = audioDeviceSelect ? audioDeviceSelect.value : '';
          const selectedLabel = audioDeviceSelect && audioDeviceSelect.selectedOptions[0]
            ? audioDeviceSelect.selectedOptions[0].textContent
            : '';
          syncAudioThruState(isVirtualAudioBridge(selectedLabel), false);
          const active = await visualEngine.startDeviceAudio(selectedId);
          await populateAudioDevices();
          const refreshedLabel = audioDeviceSelect && audioDeviceSelect.selectedOptions[0]
            ? audioDeviceSelect.selectedOptions[0].textContent
            : selectedLabel;
          if (isVirtualAudioBridge(refreshedLabel)) {
            syncAudioThruState(true, false);
          }
          syncAudioHudState({ active, mode: 'device' });
          showToast(`Audio Live activo: ${refreshedLabel || 'Entrada por defecto'}`, 'cyan');
        }
      } catch (e) {
        showToast('No se pudo activar la entrada de audio', 'warn');
      }
    });
  }

  // Audio input device selector (Pro Tools Bridge, BlackHole 2ch, SSL 2, mic, etc.)
  if (audioDeviceSelect) {
    audioDeviceSelect.addEventListener('change', async () => {
      if (!visualEngine) return;
      if (globalAudioEl && !globalAudioEl.paused) {
        globalAudioEl.pause();
      }
      const deviceId = audioDeviceSelect.value;
      const selectedLabel = audioDeviceSelect.selectedOptions[0]
        ? audioDeviceSelect.selectedOptions[0].textContent
        : 'Dispositivo de audio';
      const autoThru = isVirtualAudioBridge(selectedLabel);
      syncAudioThruState(autoThru, false);
      try {
        const aDev = ensureMasterAudioRouting();
        if (aDev && aDev.context && aDev.context.state !== 'running') {
          await aDev.context.resume();
        }
        await visualEngine.startDeviceAudio(deviceId);
        await populateAudioDevices();
        syncAudioHudState({ active: true, mode: 'device' });
        showToast(
          autoThru
            ? `🎛️ ${selectedLabel} (Audio Thru ON)`
            : `🎛️ Entrada FFT: ${selectedLabel}`,
          'cyan'
        );
      } catch (e) {
        syncAudioHudState({ active: visualEngine.audio.active, mode: visualEngine.audio.mode });
        showToast('No se pudo capturar el dispositivo de audio seleccionado', 'warn');
      }
    });
  }

  // Local audio file button + hidden <input type="file" accept="audio/*"> (singleton MediaElementAudioSourceNode)
  if (btnLoadAudio && audioFileInput) {
    btnLoadAudio.addEventListener('click', () => {
      audioFileInput.click();
    });

    audioFileInput.addEventListener('change', async () => {
      const file = audioFileInput.files && audioFileInput.files[0];
      if (!file || !visualEngine) {
        audioFileInput.value = '';
        return;
      }
      try {
        stopLiveAudioStreamOnly();
        const a = ensureGlobalTrackPlayer();
        if (!a) throw new Error('Audio graph unavailable');
        routeTrackSourceToAnalyserAndSpeakers();

        if (a.objectUrl) {
          try { URL.revokeObjectURL(a.objectUrl); } catch (e) { }
          a.objectUrl = null;
        }
        a.objectUrl = URL.createObjectURL(file);
        globalAudioEl.src = a.objectUrl;
        globalAudioEl.muted = false;
        globalAudioEl.volume = 1.0;
        globalAudioEl.load();

        if (a.context.state !== 'running') {
          await a.context.resume();
        }
        await globalAudioEl.play();

        a.fileName = file.name || 'Pista Local';
        a.mode = 'file';
        a.active = true;
        syncAudioHudState({ active: true, mode: 'file' });
        showToast(`🎵 Pista reproduciendo: ${a.fileName}`, 'cyan');
      } catch (e) {
        console.warn('[Vortex Audio] Error cargando/reproduciendo pista:', e);
        syncAudioHudState({ active: false, mode: 'none' });
        showToast('No se pudo reproducir el archivo de audio', 'warn');
      } finally {
        audioFileInput.value = '';
      }
    });
  }

  if (btnAudioPlayPause) {
    btnAudioPlayPause.addEventListener('click', async () => {
      if (!visualEngine) return;
      const trackEl = globalAudioEl || visualEngine.audio.element;
      if (!trackEl || !trackEl.src) return;
      try {
        if (trackEl.paused || trackEl.ended) {
          stopLiveAudioStreamOnly();
          const a = ensureGlobalTrackPlayer();
          routeTrackSourceToAnalyserAndSpeakers();
          if (a && a.context && a.context.state !== 'running') {
            await a.context.resume();
          }
          trackEl.muted = false;
          trackEl.volume = 1.0;
          await trackEl.play();
          if (a) {
            a.mode = 'file';
            a.active = true;
          }
          syncAudioHudState({ active: true, mode: 'file' });
        } else {
          trackEl.pause();
          visualEngine.audio.active = false;
          visualEngine.audio.bass = visualEngine.audio.mid = visualEngine.audio.treble = 0;
          syncAudioHudState({ active: false, mode: 'file' });
        }
      } catch (e) {
        showToast('Error al pausar/reanudar pista de audio', 'warn');
      }
    });
  }

  syncAudioHudState({ active: false, mode: 'none' });

  // --- MIDI Learn Mode Toggle & MIDI Note Mapping for Buttons ---
  const MIDI_NOTE_STORAGE_KEY = 'vortex_midi_note_mappings';
  let midiNoteMappings = {}; // { [noteNumber]: buttonId }
  let waitingMidiLearnButtonId = null;

  try {
    const rawNoteMap = JSON.parse(localStorage.getItem(MIDI_NOTE_STORAGE_KEY) || '{}');
    if (rawNoteMap && typeof rawNoteMap === 'object' && !Array.isArray(rawNoteMap)) {
      midiNoteMappings = rawNoteMap;
    }
  } catch (e) {
    midiNoteMappings = {};
  }

  function persistMidiNoteMappings() {
    try {
      localStorage.setItem(MIDI_NOTE_STORAGE_KEY, JSON.stringify(midiNoteMappings));
    } catch (e) { }
  }

  function ensureMappableButtonIds() {
    document.querySelectorAll('button').forEach((btn, idx) => {
      if (btn.id) return;
      const actionId = btn.getAttribute('data-action-id');
      if (actionId) {
        btn.id = `midiBtn_${actionId}`;
      } else if (btn.hasAttribute('data-scene-index')) {
        const scIdx = parseInt(btn.getAttribute('data-scene-index'), 10);
        if (!Number.isNaN(scIdx)) btn.id = `btnShowCue${scIdx + 1}`;
      } else if (btn.hasAttribute('data-col')) {
        btn.id = `midiBtn_col_${btn.getAttribute('data-col')}`;
      } else if (btn.hasAttribute('data-gen')) {
        btn.id = `midiBtn_gen_${btn.getAttribute('data-gen')}`;
      } else if (btn.hasAttribute('data-three-world')) {
        btn.id = `midiBtn_3d_${btn.getAttribute('data-three-world')}`;
      } else if (btn.hasAttribute('data-sample-id')) {
        btn.id = `midiBtn_sample_${btn.getAttribute('data-sample-id')}`;
      } else {
        btn.id = `midiBtn_auto_${idx}`;
      }
    });
  }

  function refreshMidiNoteBadges() {
    ensureMappableButtonIds();
    document.querySelectorAll('.midi-note-badge').forEach(el => el.remove());

    Object.entries(midiNoteMappings).forEach(([noteStr, buttonId]) => {
      if (!buttonId) return;
      const btn = document.getElementById(buttonId);
      if (!btn) return;
      const badge = document.createElement('span');
      badge.className = 'midi-note-badge';
      badge.textContent = `[N${noteStr}]`;
      badge.title = `Nota MIDI #${noteStr} asignada desde Purr Data`;
      btn.appendChild(badge);
    });
  }

  function clearWaitingMidiLearnButton() {
    waitingMidiLearnButtonId = null;
    document.querySelectorAll('.midi-learn-waiting').forEach(el => {
      el.classList.remove('midi-learn-waiting');
    });
  }

  function handleIncomingMidiNote(noteRaw, velocityRaw) {
    const note = parseInt(noteRaw, 10);
    const velocity = velocityRaw !== undefined ? parseInt(velocityRaw, 10) : 127;
    if (Number.isNaN(note) || Number.isNaN(velocity)) return;

    if (midiLed) {
      midiLed.className = 'status-led online';
      midiLed.style.transform = 'scale(1.4)';
      midiLed.style.boxShadow = '0 0 12px var(--accent-amber)';
      setTimeout(() => {
        midiLed.style.transform = 'scale(1)';
        midiLed.style.boxShadow = '';
      }, 70);
    }
    if (midiStatusText) {
      midiStatusText.textContent = `UDP NOTE ${note} · vel ${velocity}`;
    }

    // 1. MIDI Learn Assignment when a button is waiting for a pad hit
    if (midiBridge && midiBridge.isMidiLearnActive && waitingMidiLearnButtonId) {
      if (velocity <= 0) return; // Ignore Note-Off while learning
      const targetId = waitingMidiLearnButtonId;

      // Remove any stale note previously bound to the same button
      Object.keys(midiNoteMappings).forEach((k) => {
        if (midiNoteMappings[k] === targetId) delete midiNoteMappings[k];
      });
      midiNoteMappings[String(note)] = targetId;
      persistMidiNoteMappings();

      clearWaitingMidiLearnButton();
      midiBridge.toggleMidiLearn(false);
      if (btnMidiLearn) btnMidiLearn.classList.remove('active');
      refreshMidiNoteBadges();

      const mappedBtn = document.getElementById(targetId);
      const btnText = mappedBtn ? mappedBtn.textContent.replace(/\[N\d+\]/g, '').trim() : targetId;
      showToast(`🎹 Nota MIDI #${note} asignada a "${btnText}"`, 'cyan');
      return;
    }

    // 2. Normal Live Trigger: velocity > 0 triggers bioPulse peak in 3D world + native .click() on mapped button
    if (velocity > 0) {
      if (typeof triggerBioPulsePeak === 'function') {
        triggerBioPulsePeak(velocity);
      }
      const mappedId = midiNoteMappings[String(note)] || midiNoteMappings[note];
      if (mappedId) {
        const targetBtn = document.getElementById(mappedId);
        if (targetBtn) {
          targetBtn.click();
        }
      }
    }
  }

  // Intercept incoming WebSocket { type: "midi_note", note, velocity } cleanly
  if (midiBridge && typeof midiBridge.handleWsMessage === 'function') {
    const origHandleWsMessage = midiBridge.handleWsMessage.bind(midiBridge);
    midiBridge.handleWsMessage = (raw) => {
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('{')) {
          try {
            const data = JSON.parse(trimmed);
            if (data && data.type === 'midi_note') {
              handleIncomingMidiNote(data.note, data.velocity);
              return;
            }
          } catch (e) { }
        }
      }
      return origHandleWsMessage(raw);
    };
  }

  // Capture clicks on buttons while MIDI Learn is active to arm them instead of running their action
  document.addEventListener('click', (e) => {
    if (!midiBridge || !midiBridge.isMidiLearnActive) return;
    const btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!btn) return;
    if (
      btn === btnMidiLearn ||
      btn.classList.contains('panel-collapse-btn') ||
      btn.classList.contains('modal-close-btn') ||
      btn.classList.contains('epilepsy-enter-btn') ||
      btn.classList.contains('delete-media-btn')
    ) {
      return;
    }

    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    ensureMappableButtonIds();
    if (!btn.id) return;

    // Clear any armed knob so only this button waits for incoming Note
    if (midiBridge.armedKnob) {
      midiBridge.armedKnob.setArmed(false);
      midiBridge.armedKnob = null;
    }

    const alreadyWaiting = waitingMidiLearnButtonId === btn.id;
    clearWaitingMidiLearnButton();
    if (!alreadyWaiting) {
      waitingMidiLearnButtonId = btn.id;
      btn.classList.add('midi-learn-waiting');
      const cleanName = btn.textContent.replace(/\[N\d+\]/g, '').trim() || btn.id;
      showToast(`🎹 Esperando Nota MIDI desde Purr Data para "${cleanName}"...`, 'warn');
    }
  }, true);

  if (btnMidiLearn) {
    btnMidiLearn.addEventListener('click', () => {
      const active = midiBridge.toggleMidiLearn();
      btnMidiLearn.classList.toggle('active', active);
      if (!active) {
        clearWaitingMidiLearnButton();
      }
      showToast(
        active
          ? '🎹 MIDI Learn activo: haz clic en una perilla (CC) o en un botón/Cue (Nota) desde Purr Data'
          : 'MIDI Learn finalizado',
        'warn'
      );
    });
  }

  // --- WebSocket Bridge Host Reconnect ---
  if (btnWsConnect && wsUrlInput) {
    btnWsConnect.addEventListener('click', () => {
      const url = wsUrlInput.value.trim();
      if (url) {
        localStorage.setItem('vortex_td_ws_url', url);
        if (tdModalWsInput) tdModalWsInput.value = url;
        midiBridge.connectWebSocket(url);
      }
    });

    wsUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = wsUrlInput.value.trim();
        if (url) {
          localStorage.setItem('vortex_td_ws_url', url);
          if (tdModalWsInput) tdModalWsInput.value = url;
          midiBridge.connectWebSocket(url);
        }
      }
    });
  }

  // --- Sub-Action Buttons (WebGL + TouchDesigner Trigger Routing) ---
  // 1. Generator Waveforms (si está atenuado por Media, Mundo 3D o modo TD, activa el Generador al 100%)
  document.querySelectorAll('[data-gen]').forEach(btn => {
    btn.addEventListener('click', () => {
      clearThreeWorldActiveButtons();
      document.querySelectorAll('[data-gen]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = parseInt(btn.getAttribute('data-gen'), 10);
      const genLabel = genModeNames[mode] || 'Fluid';
      if (activeEngine === 'td' || (visualEngine && visualEngine.sourceMode !== 'generator')) {
        activateGenerativeMode(false);
      } else {
        currentSourceSnapshot = {
          kind: 'generator',
          genMode: mode,
          tdPaletteId: currentSourceSnapshot.tdPaletteId || 'td_pal_reaction',
          sampleId: null,
          sourceName: `Gen: ${genLabel}`
        };
        updateSourceIndicator('generator', `Modo Generativo (${genLabel})`);
      }
      if (visualEngine) {
        visualEngine.setParam('genMode', mode);
      }
      emitTdTriggerForButton(btn, true, mode);
    });
  });

  // 1b. Three.js Interactive 3D Worlds (Aquarium 3D, Particles 3D, Cyber World, Swarm 3D)
  document.querySelectorAll('[data-three-world]').forEach(btn => {
    btn.addEventListener('click', () => {
      const worldIdx = parseInt(btn.getAttribute('data-three-world'), 10) || 0;
      activateThreeWorld(worldIdx, false);
      emitTdTriggerForButton(btn, true, worldIdx);
    });
  });

  if (btnAutoFlight3d) {
    btnAutoFlight3d.addEventListener('click', () => {
      const engine3d = visualEngine && visualEngine.threeEngine;
      const nextState = engine3d ? !engine3d.autoFlight : !btnAutoFlight3d.classList.contains('active');
      if (engine3d) engine3d.setAutoFlight(nextState);
      btnAutoFlight3d.classList.toggle('active', nextState);
      btnAutoFlight3d.setAttribute('aria-pressed', String(nextState));
      btnAutoFlight3d.textContent = nextState ? '🚀 Auto-Viaje 3D: ON' : '🚀 Auto-Viaje 3D: OFF';
      showToast(
        nextState
          ? '🚀 Auto-Viaje 3D activado (combinado con WASD + Mouse + MIDI)'
          : '🎮 Auto-Viaje 3D pausado: control manual WASD / Mouse / MIDI',
        nextState ? 'cyan' : 'info'
      );
    });
  }

  // 3. Color Modes (Original, Cyberpunk, Infrarrojo, Monocromo)
  document.querySelectorAll('[data-col]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-col]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const palette = btn.getAttribute('data-col');

      if (palette === 'original') {
        if (visualEngine) visualEngine.params.monochrome = false;
        knobs['chroma']?.setValue(0.0, true, 'ui');
        knobs['hue']?.setValue(0, true, 'ui');
        knobs['feedback']?.setValue(0.0, true, 'ui');
        if (midiBridge) {
          midiBridge.sendTdTrigger({ id: 'color_original', action: 'color_original', state: true, value: 1 });
        }
      } else if (palette === 'cyberpunk') {
        if (visualEngine) visualEngine.params.monochrome = false;
        knobs['chroma']?.setValue(0.75, true, 'ui');
        knobs['hue']?.setValue(290, true, 'ui');
        knobs['feedback']?.setValue(0.55, true, 'ui');
        if (midiBridge) {
          midiBridge.sendTdTrigger({ id: 'color_cyberpunk', action: 'color_cyberpunk', state: true, value: 1 });
        }
      } else if (palette === 'infrared') {
        if (visualEngine) visualEngine.params.monochrome = false;
        knobs['chroma']?.setValue(0.95, true, 'ui');
        knobs['hue']?.setValue(140, true, 'ui');
        knobs['feedback']?.setValue(0.35, true, 'ui');
        if (midiBridge) {
          midiBridge.sendTdTrigger({ id: 'color_infrared', action: 'color_infrared', state: true, value: 1 });
        }
      } else if (palette === 'mono') {
        if (visualEngine) visualEngine.params.monochrome = true;
        knobs['chroma']?.setValue(0.0, true, 'ui');
        knobs['hue']?.setValue(0, true, 'ui');
        knobs['feedback']?.setValue(0.25, true, 'ui');
        if (midiBridge) {
          midiBridge.sendTdTrigger({ id: 'color_mono', action: 'color_mono', state: true, value: 1 });
        }
      }
    });
  });

  // 2. Displace: Glitch Burst
  if (btnGlitchBurst) {
    btnGlitchBurst.addEventListener('click', () => {
      if (visualEngine) {
        const oldDisplace = knobs['displace']?.value ?? 0.15;
        const oldChroma = knobs['chroma']?.value ?? 0.2;
        knobs['displace']?.setValue(0.85, true, 'ui');
        knobs['chroma']?.setValue(0.9, true, 'ui');
        visualEngine.triggerBurst();

        setTimeout(() => {
          knobs['displace']?.setValue(oldDisplace, true, 'ui');
          knobs['chroma']?.setValue(oldChroma, true, 'ui');
        }, 280);
      }
      emitTdTriggerForButton(btnGlitchBurst, true);
    });
  }

  // 2. Displace: Freeze Frame
  let isFrozen = false;
  if (btnFreeze) {
    btnFreeze.addEventListener('click', () => {
      isFrozen = !isFrozen;
      btnFreeze.classList.toggle('active', isFrozen);
      if (visualEngine) visualEngine.params.freeze = isFrozen;
      emitTdTriggerForButton(btnFreeze, isFrozen, isFrozen ? 1 : 0);
      showToast(isFrozen ? 'Imagen Congelada' : 'Reproduciendo animación');
    });
  }

  // 2. Displace: Clean Preset
  if (btnClean) {
    btnClean.addEventListener('click', () => {
      isFrozen = false;
      if (btnFreeze) btnFreeze.classList.remove('active');
      isInverted = false;
      if (btnInvert) btnInvert.classList.remove('active');
      knobs['displace']?.setValue(0.03, true, 'ui');
      knobs['feedback']?.setValue(0.10, true, 'ui');
      knobs['chroma']?.setValue(0.0, true, 'ui');
      knobs['hue']?.setValue(0, true, 'ui');
      knobs['kaleido']?.setValue(0.0, true, 'ui');
      knobs['mirrorAngle']?.setValue(0, true, 'ui');
      pixelCrtActive = false;
      if (btnPixelCrt) btnPixelCrt.classList.remove('active');
      if (visualEngine) {
        visualEngine.params.freeze = false;
        visualEngine.params.invert = false;
        visualEngine.params.pixelCrt = false;
      }
      if (midiBridge) {
        midiBridge.sendTdTrigger({ id: 'fx_freeze', action: 'fx_freeze', state: false, value: 0 });
        midiBridge.sendTdTrigger({ id: 'master_invert', action: 'master_invert', state: false, value: 0 });
        midiBridge.sendTdTrigger({ id: 'fx_pixel_crt', action: 'fx_pixel_crt', state: false, value: 0 });
      }
      emitTdTriggerForButton(btnClean, true);
      showToast('Efectos sutiles: Imagen limpia y reconocible', 'cyan');
    });
  }

  // Master BPM Lock Toggle (🔒 BPM Fijo entre escenas)
  if (btnLockBpm) {
    btnLockBpm.addEventListener('click', () => {
      bpmLocked = !bpmLocked;
      btnLockBpm.classList.toggle('active', bpmLocked);
      btnLockBpm.setAttribute('aria-pressed', String(bpmLocked));
      btnLockBpm.textContent = bpmLocked ? '🔒' : '🔓';
      showToast(
        bpmLocked
          ? '🔒 BPM Maestro bloqueado entre escenas y Auto-Show'
          : '🔓 BPM libre: cada Cue podrá cambiar la velocidad',
        bpmLocked ? 'cyan' : 'info'
      );
    });
  }

  // --- 4. MASTER / TEMPO: Pulse On/Off, BPM, Multipliers & Waveforms ---
  if (btnPulseToggle) {
    btnPulseToggle.addEventListener('click', () => {
      pulseEnabled = !pulseEnabled;
      btnPulseToggle.classList.toggle('active', pulseEnabled);
      btnPulseToggle.textContent = pulseEnabled ? '⚡ Pulse: ON' : '⚡ Pulse: OFF';
      if (visualEngine) {
        visualEngine.setPulseEnabled(pulseEnabled);
      }
      emitTdTriggerForButton(btnPulseToggle, pulseEnabled, pulseEnabled ? 1 : 0);
      showToast(
        pulseEnabled
          ? `Pulso rítmico ACTIVADO (${currentBpm} BPM · x${beatMultiplier} · ${waveShape.toUpperCase()})`
          : 'Pulso rítmico DESACTIVADO (imagen estable sin parpadeo)',
        pulseEnabled ? 'cyan' : 'info'
      );
    });
  }

  // Tap Tempo BPM (40 to 200 BPM)
  const tapTimes = [];
  if (btnTapBPM) {
    btnTapBPM.addEventListener('click', () => {
      const now = performance.now();
      if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2500) {
        tapTimes.length = 0;
      }
      tapTimes.push(now);
      if (tapTimes.length > 5) tapTimes.shift();

      if (tapTimes.length >= 2) {
        let intervalSum = 0;
        for (let i = 1; i < tapTimes.length; i++) {
          intervalSum += tapTimes[i] - tapTimes[i - 1];
        }
        const avgInterval = intervalSum / (tapTimes.length - 1);
        const calculatedBpm = Math.max(40, Math.min(200, Math.round(60000 / avgInterval)));
        currentBpm = calculatedBpm;
        knobs['bpm']?.setValue(calculatedBpm, true, 'ui');
        beatPhase = Math.floor(beatPhase);
        showToast(`Tempo Tap: ${calculatedBpm} BPM`, 'cyan');
      }
      emitTdTriggerForButton(btnTapBPM, true, currentBpm);
      btnTapBPM.style.borderColor = 'var(--accent-amber)';
      setTimeout(() => (btnTapBPM.style.borderColor = ''), 150);
    });
  }

  // Beat Division Selector: 1/1, 1/2, 1/4, x2, x4
  if (selectBeatDivision) {
    selectBeatDivision.addEventListener('change', () => {
      beatMultiplier = Number(selectBeatDivision.value) || 1;
      if (visualEngine) visualEngine.setBeatMultiplier(beatMultiplier);
      emitTdTriggerForButton(selectBeatDivision, true, beatMultiplier);
      const label = selectBeatDivision.selectedOptions[0]?.textContent || `x${beatMultiplier}`;
      showToast(`División de pulso: ${label}`);
    });
  }

  // Waveform Selector: Sine, Saw, Square, Triangle
  if (selectWaveShape) {
    selectWaveShape.addEventListener('change', () => {
      waveShape = selectWaveShape.value || 'sine';
      if (visualEngine) visualEngine.setWaveShape(waveShape);
      emitTdTriggerForButton(selectWaveShape, true, waveShape);
      showToast(`Forma de onda: ${waveShape.toUpperCase()}`);
    });
  }

  // Clock Advance Mode: Por Tempo BPM vs Por Golpe de Bass/Kick
  function setClockAdvanceMode(mode) {
    clockAdvanceMode = (mode === 'kick') ? 'kick' : 'bpm';
    if (btnClockBpm) btnClockBpm.classList.toggle('active', clockAdvanceMode === 'bpm');
    if (btnClockKick) btnClockKick.classList.toggle('active', clockAdvanceMode === 'kick');
    showToast(
      clockAdvanceMode === 'kick'
        ? '🥁 Secuenciador sincronizado a golpes de Bass/Kick'
        : '⏱️ Secuenciador sincronizado al Tempo BPM',
      'cyan'
    );
  }
  if (btnClockBpm) btnClockBpm.addEventListener('click', () => setClockAdvanceMode('bpm'));
  if (btnClockKick) btnClockKick.addEventListener('click', () => setClockAdvanceMode('kick'));

  // Pulse Modulation Target Cycle (Deformar / Caleido / Color — sin parpadeo de brillo)
  const lfoTargets = [
    { label: '🎯 Pulso: Deformar', value: 'deform' },
    { label: '🎯 Pulso: Caleido', value: 'kaleido' },
    { label: '🎯 Pulso: Color', value: 'color' }
  ];
  let currentLfoTargetIdx = 0;
  if (btnLfoTarget) {
    btnLfoTarget.addEventListener('click', () => {
      currentLfoTargetIdx = (currentLfoTargetIdx + 1) % lfoTargets.length;
      const target = lfoTargets[currentLfoTargetIdx];
      btnLfoTarget.textContent = target.label;
      if (visualEngine) visualEngine.setLfoTarget(target.value);
      emitTdTriggerForButton(btnLfoTarget, true, target.value);
      showToast(`Reloj modula: ${target.label}`, 'cyan');
    });
  }

  // Pixel / CRT Continuous Toggle Effect
  if (btnPixelCrt) {
    btnPixelCrt.addEventListener('click', () => {
      pixelCrtActive = !pixelCrtActive;
      btnPixelCrt.classList.toggle('active', pixelCrtActive);
      if (visualEngine) {
        visualEngine.params.pixelCrt = pixelCrtActive;
      }
      if (midiBridge) {
        midiBridge.sendTdTrigger({
          id: 'fx_pixel_crt',
          action: 'fx_pixel_crt',
          state: pixelCrtActive,
          value: pixelCrtActive ? 1 : 0
        });
      }
      showToast(
        pixelCrtActive
          ? '🌀 Efecto Pixel / CRT reactivo al bajo: ON'
          : '🌀 Efecto Pixel / CRT: OFF',
        pixelCrtActive ? 'cyan' : 'info'
      );
    });
  }

  // Flash Burst
  if (btnBurstFlash) {
    btnBurstFlash.addEventListener('click', () => {
      if (visualEngine) visualEngine.triggerBurst();
      emitTdTriggerForButton(btnBurstFlash, true);
    });
  }

  // Invert Color Toggle
  if (btnInvert) {
    btnInvert.addEventListener('click', () => {
      isInverted = !isInverted;
      btnInvert.classList.toggle('active', isInverted);
      if (visualEngine) visualEngine.params.invert = isInverted;
      emitTdTriggerForButton(btnInvert, isInverted, isInverted ? 1 : 0);
    });
  }

  // =========================================================================
  // 🎬 LIVE SHOW SEQUENCES (8 CUES + TIMELINE + SONG .VORTEX.JSON + AUTO-SHOW)
  // =========================================================================
  const SHOW_SCENES_STORAGE_KEY = 'vortex_show_scenes_v5';

  const FACTORY_SCENES = [
    {
      name: 'Intro',
      sourceName: '3D: Aquarium 3D',
      duration: 16,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'three', threeWorld: 0, genMode: 0, tdPaletteId: 'td_pal_plasma', sampleId: null, sourceName: '3D: Aquarium 3D' },
      knobs: { frequency: 0.28, detail: 0.42, speed: 0.30, displace: 0.08, warpScale: 0.35, audioDepth: 0.55, feedback: 0.28, chroma: 0.12, hue: 0, kaleido: 0.0, mirrorAngle: 0 },
      color: 'original',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: false }
    },
    {
      name: 'Verso',
      sourceName: 'Vortex',
      duration: 32,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'generator', genMode: 1, tdPaletteId: 'td_pal_tunnel', sampleId: null, sourceName: 'Vortex' },
      knobs: { frequency: 0.48, detail: 0.62, speed: 0.48, displace: 0.24, warpScale: 0.55, audioDepth: 0.70, feedback: 0.52, chroma: 0.45, hue: 240, kaleido: 0.18, mirrorAngle: 30 },
      color: 'cyberpunk',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: true }
    },
    {
      name: 'Pre-Coro',
      sourceName: '3D: Endless Drive 3D',
      duration: 16,
      durationUnit: 'beats',
      kineticText: 'VORTEX',
      source: { kind: 'three', threeWorld: 1, genMode: 0, tdPaletteId: 'td_pal_voronoi', sampleId: null, sourceName: '3D: Endless Drive 3D' },
      knobs: { frequency: 0.55, detail: 0.68, speed: 0.60, displace: 0.20, warpScale: 0.55, audioDepth: 0.75, feedback: 0.45, chroma: 0.52, hue: 210, kaleido: 0.0, mirrorAngle: 0 },
      color: 'cyberpunk',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: true }
    },
    {
      name: 'Coro/Drop',
      sourceName: 'Rings',
      duration: 32,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'generator', genMode: 2, tdPaletteId: 'td_pal_reaction', sampleId: null, sourceName: 'Rings' },
      knobs: { frequency: 0.78, detail: 0.85, speed: 0.72, displace: 0.50, warpScale: 0.82, audioDepth: 0.85, feedback: 0.74, chroma: 0.90, hue: 140, kaleido: 0.55, mirrorAngle: 180 },
      color: 'infrared',
      pads: { freeze: false, invert: false, pixelCrt: true, pulse: true }
    },
    {
      name: 'Break',
      sourceName: '3D: Bio-Terra 3D',
      duration: 16,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'three', threeWorld: 2, genMode: 0, tdPaletteId: 'td_pal_reaction', sampleId: null, sourceName: '3D: Bio-Terra 3D' },
      knobs: { frequency: 0.25, detail: 0.52, speed: 0.28, displace: 0.10, warpScale: 0.28, audioDepth: 0.55, feedback: 0.38, chroma: 0.18, hue: 180, kaleido: 0.0, mirrorAngle: 0 },
      color: 'original',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: false }
    },
    {
      name: 'Solo',
      sourceName: 'Danza Neon',
      duration: 16,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'sample', sampleId: 'dancer', genMode: 1, tdPaletteId: 'td_pal_plasma', sourceName: 'Danza Neon' },
      knobs: { frequency: 0.60, detail: 0.70, speed: 0.62, displace: 0.26, warpScale: 0.48, audioDepth: 0.80, feedback: 0.68, chroma: 0.72, hue: 310, kaleido: 0.25, mirrorAngle: 45 },
      color: 'cyberpunk',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: true }
    },
    {
      name: 'Clímax',
      sourceName: '3D: Potree LiDAR 3D',
      duration: 32,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'three', threeWorld: 3, genMode: 3, tdPaletteId: 'td_pal_voronoi', sampleId: null, sourceName: '3D: Potree LiDAR 3D' },
      knobs: { frequency: 0.78, detail: 0.82, speed: 0.68, displace: 0.28, warpScale: 0.65, audioDepth: 0.85, feedback: 0.54, chroma: 0.65, hue: 280, kaleido: 0.0, mirrorAngle: 0 },
      color: 'original',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: true }
    },
    {
      name: 'Outro',
      sourceName: 'Concierto',
      duration: 16,
      durationUnit: 'beats',
      kineticText: '',
      source: { kind: 'sample', sampleId: 'concert', genMode: 0, tdPaletteId: 'td_pal_tunnel', sourceName: 'Concierto' },
      knobs: { frequency: 0.32, detail: 0.40, speed: 0.25, displace: 0.12, warpScale: 0.32, audioDepth: 0.40, feedback: 0.38, chroma: 0.15, hue: 20, kaleido: 0.0, mirrorAngle: 0 },
      color: 'original',
      pads: { freeze: false, invert: false, pixelCrt: false, pulse: false }
    }
  ];

  function loadShowScenes() {
    try {
      const raw = localStorage.getItem(SHOW_SCENES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 8) return parsed;
      }
    } catch (e) { }
    return FACTORY_SCENES.map(s => JSON.parse(JSON.stringify(s)));
  }

  let showScenes = loadShowScenes();

  function isCustomMediaSource(src) {
    if (!src) return false;
    if (src.kind === 'custom_media' || src.isCustom) return true;
    if (src.kind === 'sample' && src.sampleId && sampleMediaList.some(s => s.id === src.sampleId)) return false;
    if (src.mode === 'media' && (src.dataUrl || src.src || src.serverPath || src.file)) return true;
    return Boolean(src.dataUrl || src.serverPath || (src.file && String(src.file).startsWith('/uploads')));
  }

  function ensureCustomMediaFromSource(src, fallbackLabel = 'Media') {
    if (!isCustomMediaSource(src)) return null;
    const itemId = src.sampleId || `custom_restored_${(src.name || src.sourceName || fallbackLabel).replace(/[^a-z0-9]/gi, '_').slice(0, 18)}`;
    const deletedIds = getDeletedCustomMediaIds();
    if (deletedIds.has(itemId)) return null;
    let item = customMediaList.find(m => m.id === itemId);
    const resolvedSrc = src.dataUrl || src.serverPath || src.src || src.file;
    if (!item && resolvedSrc) {
      const nonBlobPath = (src.serverPath || (src.file && !String(src.file).startsWith('blob:') ? src.file : null));
      item = {
        id: itemId,
        title: src.name || src.sourceName || fallbackLabel,
        fileName: src.sourceName || src.name || fallbackLabel,
        mediaType: src.mediaType === 'video' ? 'video' : 'image',
        isCustom: true,
        file: nonBlobPath || resolvedSrc,
        src: resolvedSrc,
        thumb: src.thumb || src.dataUrl || (src.mediaType === 'video' ? makeFallbackVideoThumbSvg(src.name || src.sourceName || fallbackLabel) : resolvedSrc),
        dataUrl: src.dataUrl || (String(resolvedSrc).startsWith('data:') ? resolvedSrc : null),
        uploadPath: src.serverPath || (nonBlobPath && String(nonBlobPath).startsWith('/uploads') ? nonBlobPath : null),
        serverPath: src.serverPath || (nonBlobPath && String(nonBlobPath).startsWith('/uploads') ? nonBlobPath : null),
        absolutePath: src.absolutePath || null
      };
      customMediaList.push(item);
      persistCustomMediaList();
      renderSampleGrid();
    } else if (item) {
      if (!item.dataUrl && src.dataUrl) item.dataUrl = src.dataUrl;
      if (!item.uploadPath && (src.serverPath || (src.file && String(src.file).startsWith('/uploads')))) {
        item.uploadPath = src.serverPath || src.file;
        item.serverPath = item.uploadPath;
        item.file = item.uploadPath;
      }
      if (!item.thumb && src.thumb) item.thumb = src.thumb;
      persistCustomMediaList();
    }
    return item || null;
  }

  // Hydrate any custom media restored from saved Cues into gallery at startup
  showScenes.forEach((sc, i) => {
    if (sc && sc.source && isCustomMediaSource(sc.source)) {
      ensureCustomMediaFromSource(sc.source, sc.sourceName || sc.name || `Cue ${i + 1}`);
    }
  });

  function persistShowScenes() {
    try {
      localStorage.setItem(SHOW_SCENES_STORAGE_KEY, JSON.stringify(showScenes));
    } catch (e) {
      // If quota exceeded due to large base64 images, strip inline dataUrls ONLY when /uploads path exists on disk
      try {
        const lean = showScenes.map(sc => {
          const copy = JSON.parse(JSON.stringify(sc));
          const serverBacked = copy.source && (copy.source.serverPath || (copy.source.file && String(copy.source.file).startsWith('/uploads')));
          if (copy.source && copy.source.dataUrl && serverBacked && copy.source.dataUrl.length > 260000) {
            delete copy.source.dataUrl;
            if (copy.source.src && String(copy.source.src).startsWith('data:')) {
              copy.source.src = copy.source.serverPath || copy.source.file;
            }
          }
          return copy;
        });
        localStorage.setItem(SHOW_SCENES_STORAGE_KEY, JSON.stringify(lean));
      } catch (e2) { }
    }
  }

  function getCuePreviewImageUrl(scene) {
    const src = scene && scene.source;
    if (!src) return null;
    let candidate = null;
    if (src.kind === 'sample' && src.sampleId) {
      const sample = sampleMediaList.find(s => s.id === src.sampleId);
      candidate = sample ? (sample.thumb || sample.file) : null;
    } else if (src.kind === 'api_video') {
      candidate = src.thumb || 'media/thumbs/tunnel.svg';
    } else if (isCustomMediaSource(src)) {
      const customItem = customMediaList.find(m => m.id === src.sampleId);
      candidate = (customItem && (customItem.thumb || customItem.dataUrl || (customItem.mediaType === 'image' ? (customItem.uploadPath || customItem.file) : null)))
        || src.thumb
        || src.dataUrl
        || (src.mediaType !== 'video' ? (src.serverPath || src.src || src.file) : null);
    }
    if (!candidate || typeof candidate !== 'string') return null;
    if (candidate.startsWith('data:image/') || candidate.startsWith('media/thumbs/')) return candidate;
    if (/\.(mp4|mov|webm|m4v|avi|mkv)(\?.*)?$/i.test(candidate)) return null;
    if (candidate.startsWith('blob:') && src.mediaType === 'video') return null;
    return candidate;
  }

  function syncCueEditInputs(scene, forceNameSync = false) {
    const sc = scene || showScenes[activeSceneIndex];
    if (!sc) return;
    const dur = Math.max(1, Number(sc.duration) || 16);
    const unit = sc.durationUnit === 'seconds' ? 'seconds' : 'beats';
    if (inputCueName && (forceNameSync || document.activeElement !== inputCueName)) {
      inputCueName.value = sc.name || `Cue ${activeSceneIndex + 1}`;
    }
    if (inputCueDuration) inputCueDuration.value = String(dur);
    if (selectCueDurationUnit) selectCueDurationUnit.value = unit;
    if (typeof window.__syncCueSourceSelect === 'function') {
      window.__syncCueSourceSelect(sc);
    }
  }

  function updateSeqStatusUI() {
    const activeCue = showScenes[activeSceneIndex];
    if (seqStatusBadge) {
      const modeTxt = autoShowEnabled
        ? 'AUTO'
        : (seqPlaying ? (clockAdvanceMode === 'kick' ? 'KICK' : 'SEQ') : 'MANUAL');
      const cueLabel = (activeCue?.name || `Cue ${activeSceneIndex + 1}`).trim();
      const durTxt = `${Math.max(1, Number(activeCue?.duration) || 16)}${activeCue?.durationUnit === 'seconds' ? 's' : 'B'}`;
      seqStatusBadge.textContent = `CUE ${activeSceneIndex + 1} (${cueLabel}) · ${durTxt} · ${modeTxt}`;
    }
    if (seqSceneGrid) {
      seqSceneGrid.querySelectorAll('.seq-scene-pad').forEach((pad, idx) => {
        pad.classList.toggle('active', idx === activeSceneIndex);
      });
    }
  }

  const cueProgressFillEls = [];
  updateCueProgressBarFn = (idx, fraction) => {
    cueProgressFillEls.forEach((el, i) => {
      if (!el) return;
      el.style.width = (i === idx && fraction > 0) ? `${Math.min(100, fraction * 100).toFixed(1)}%` : '0%';
    });
  };

  function getCueSubtitleText(scene, idx) {
    if (scene.sourceName) return scene.sourceName;
    if (scene.source && scene.source.kind === 'three') {
      const wIdx = Math.max(0, Math.min(3, Number(scene.source.threeWorld) || 0));
      return `3D: ${threeWorldNames[wIdx] || 'Aquarium 3D'}`;
    }
    if (scene.source && (scene.source.name || scene.source.sourceName)) {
      return scene.source.name || scene.source.sourceName;
    }
    return `Cue ${idx + 1}`;
  }

  function updateCueCardDOM(idx) {
    if (!seqSceneGrid) return;
    const btn = seqSceneGrid.querySelector(`.seq-scene-pad[data-scene-index="${idx}"]`);
    const scene = showScenes[idx];
    if (!btn || !scene) return;
    const dur = Math.max(1, Number(scene.duration) || 16);
    const unitShort = scene.durationUnit === 'seconds' ? 's' : 'B';
    const cueName = (scene.name || `Cue ${idx + 1}`).trim();
    const subText = getCueSubtitleText(scene, idx);
    btn.title = `CUE ${idx + 1} · ${cueName} | Fuente: ${subText} | Duración: ${dur}${unitShort} | Arrastra imagen/video aquí (Tecla ${idx + 1} · DAW Nota ${36 + idx} · CC ${21 + idx})`;

    const durBadge = btn.querySelector('.seq-scene-dur');
    if (durBadge) durBadge.textContent = `${dur}${unitShort}`;
    const titleEl = btn.querySelector('.seq-scene-title');
    if (titleEl) titleEl.textContent = `CUE ${idx + 1} · ${cueName}`;
    const subEl = btn.querySelector('.seq-scene-sub');
    if (subEl) subEl.textContent = subText;

    const previewUrl = getCuePreviewImageUrl(scene);
    let bgEl = btn.querySelector('.seq-scene-bg');
    if (previewUrl) {
      if (!bgEl) {
        bgEl = document.createElement('span');
        bgEl.className = 'seq-scene-bg';
        btn.prepend(bgEl);
      }
      bgEl.style.backgroundImage = `url(${JSON.stringify(previewUrl)})`;
    } else if (bgEl) {
      bgEl.remove();
    }
  }

  onCustomMediaUpdatedFn = (item) => {
    if (!item || !item.id) return;
    let dirty = false;
    showScenes.forEach((sc, i) => {
      if (sc && sc.source && sc.source.sampleId === item.id) {
        if (item.dataUrl) {
          sc.source.dataUrl = item.dataUrl;
          sc.source.src = item.dataUrl;
        }
        if (item.thumb) sc.source.thumb = item.thumb;
        if (item.uploadPath) {
          sc.source.serverPath = item.uploadPath;
          sc.source.file = item.uploadPath;
          if (!sc.source.dataUrl) sc.source.src = item.uploadPath;
        }
        if (item.absolutePath) sc.source.absolutePath = item.absolutePath;
        updateCueCardDOM(i);
        dirty = true;
      }
    });
    if (dirty) persistShowScenes();
  };

  onCustomMediaDeletedFn = (deletedId) => {
    if (!deletedId) return;
    let dirty = false;
    showScenes.forEach((sc, i) => {
      if (sc && sc.source && sc.source.sampleId === deletedId) {
        sc.sourceName = 'Ciudad Cyber';
        sc.source = {
          kind: 'sample',
          sampleId: 'city',
          genMode: 0,
          tdPaletteId: 'td_pal_plasma',
          sourceName: 'Ciudad Cyber'
        };
        updateCueCardDOM(i);
        dirty = true;
      }
    });
    if (dirty) persistShowScenes();
  };

  async function assignMediaFileToCue(cueIndex, file, options = { activateNow: true }) {
    const idx = Math.max(0, Math.min(7, Number(cueIndex) || 0));
    if (!file) return;
    const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') ||
      /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg|mp4|webm|mov|m4v)$/i.test(file.name);
    if (!isMedia) {
      showToast(`Formato no soportado para Cue ${idx + 1} (${file.name})`, 'warn');
      return;
    }

    const res = await registerCustomMediaFile(file, false, false);
    if (!res || !res.customItem) return;
    const { customItem, uploadPromise } = res;

    const baseCue = showScenes[idx] ? JSON.parse(JSON.stringify(showScenes[idx])) : JSON.parse(JSON.stringify(FACTORY_SCENES[idx]));
    const isEditingActiveCue = (idx === activeSceneIndex);
    if (isEditingActiveCue && inputCueName) {
      const typedName = inputCueName.value.trim();
      if (typedName) baseCue.name = typedName;
    }
    if (isEditingActiveCue && inputCueDuration) {
      baseCue.duration = Math.max(1, parseInt(inputCueDuration.value, 10) || baseCue.duration || 16);
    }
    if (isEditingActiveCue && selectCueDurationUnit) {
      baseCue.durationUnit = selectCueDurationUnit.value === 'seconds' ? 'seconds' : 'beats';
    }

    const mediaSrc = customItem.dataUrl || customItem.uploadPath || customItem.file;
    baseCue.sourceName = (customItem.fileName || customItem.title || `Cue ${idx + 1}`).slice(0, 22);
    baseCue.source = {
      kind: 'custom_media',
      mode: 'media',
      isCustom: true,
      sampleId: customItem.id,
      name: customItem.title,
      sourceName: customItem.fileName || customItem.title,
      mediaType: customItem.mediaType,
      src: mediaSrc,
      file: customItem.uploadPath || mediaSrc,
      serverPath: customItem.uploadPath || null,
      dataUrl: customItem.dataUrl || null,
      thumb: customItem.thumb || (customItem.mediaType === 'image' ? mediaSrc : null),
      absolutePath: customItem.absolutePath || null
    };

    showScenes[idx] = baseCue;
    persistShowScenes();
    renderShowScenesGrid();

    uploadPromise.then(uploadedItem => {
      if (activeEngine === 'td' && uploadedItem && uploadedItem.uploadPath && activeSceneIndex === idx && midiBridge) {
        midiBridge.sendTdMedia({
          source: uploadedItem.uploadPath,
          mediaType: uploadedItem.mediaType,
          absolutePath: uploadedItem.absolutePath || undefined,
          mode: 'media'
        });
      }
    });

    if (options.activateNow !== false) {
      applyShowScene(idx, 'assign');
    } else {
      syncCueEditInputs(showScenes[activeSceneIndex], false);
      updateSeqStatusUI();
    }
    showToast(
      activeEngine === 'td'
        ? `🖼️ CUE ${idx + 1}: "${customItem.fileName}" guardado en escena`
        : `🖼️ CUE ${idx + 1}: "${customItem.fileName}" · Cargado en motor WebGL`,
      'cyan',
      2200
    );
  }

  function renderShowScenesGrid() {
    if (!seqSceneGrid) return;
    seqSceneGrid.innerHTML = '';
    cueProgressFillEls.length = 0;

    showScenes.forEach((scene, idx) => {
      const dur = Math.max(1, Number(scene.duration) || 16);
      const unitShort = scene.durationUnit === 'seconds' ? 's' : 'B';
      const cueName = (scene.name || `Cue ${idx + 1}`).trim();
      const subText = getCueSubtitleText(scene, idx);
      const previewUrl = getCuePreviewImageUrl(scene);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `btnShowCue${idx + 1}`;
      btn.className = `seq-scene-pad${idx === activeSceneIndex ? ' active' : ''}`;
      btn.setAttribute('data-scene-index', String(idx));
      btn.title = `CUE ${idx + 1} · ${cueName} | Fuente: ${subText} | Duración: ${dur}${unitShort} | Arrastra imagen/video aquí (Tecla ${idx + 1} · DAW Nota ${36 + idx} · CC ${21 + idx})`;

      if (previewUrl) {
        const bgEl = document.createElement('span');
        bgEl.className = 'seq-scene-bg';
        bgEl.style.backgroundImage = `url(${JSON.stringify(previewUrl)})`;
        btn.appendChild(bgEl);
      }

      const durBadge = document.createElement('span');
      durBadge.className = 'seq-scene-dur';
      durBadge.textContent = `${dur}${unitShort}`;

      const title = document.createElement('span');
      title.className = 'seq-scene-title';
      title.textContent = `CUE ${idx + 1} · ${cueName}`;

      const sub = document.createElement('span');
      sub.className = 'seq-scene-sub';
      sub.textContent = subText;

      const progTrack = document.createElement('span');
      progTrack.className = 'seq-scene-progress';
      const progFill = document.createElement('span');
      progFill.className = 'seq-scene-progress-fill';
      progTrack.appendChild(progFill);
      cueProgressFillEls.push(progFill);

      btn.appendChild(durBadge);
      btn.appendChild(title);
      btn.appendChild(sub);
      btn.appendChild(progTrack);
      btn.addEventListener('click', () => applyShowScene(idx, 'click'));

      // Direct Drag & Drop per Cue (assigns image/video directly into that Cue without blocking window overlay)
      btn.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('cue-dragover');
        if (dropOverlay) dropOverlay.classList.remove('active');
      });
      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('cue-dragover');
        if (dropOverlay) dropOverlay.classList.remove('active');
      });
      btn.addEventListener('dragleave', (e) => {
        if (!btn.contains(e.relatedTarget)) {
          btn.classList.remove('cue-dragover');
        }
      });
      btn.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        btn.classList.remove('cue-dragover');
        if (dropOverlay) dropOverlay.classList.remove('active');
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) {
          await assignMediaFileToCue(idx, files[0], { activateNow: true });
        }
      });

      seqSceneGrid.appendChild(btn);
    });
    if (typeof refreshMidiNoteBadges === 'function') {
      refreshMidiNoteBadges();
    }
  }

  function applyColorPresetByName(palette, emitTd = true) {
    document.querySelectorAll('[data-col]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-col') === palette);
    });
    if (visualEngine) {
      visualEngine.params.monochrome = (palette === 'mono');
      if (palette === 'original') visualEngine.setParam('hue', 0);
      else if (palette === 'cyberpunk') visualEngine.setParam('hue', 290 / 360);
      else if (palette === 'infrared') visualEngine.setParam('hue', 140 / 360);
    }
    if (emitTd && midiBridge) {
      const action = `color_${palette}`;
      midiBridge.sendTdTrigger({ id: action, action, state: true, value: 1 });
    }
  }
  applyColorPresetFn = applyColorPresetByName;

  function applyShowScene(index, origin = 'click') {
    const idx = Math.max(0, Math.min(7, Number(index) || 0));
    const scene = showScenes[idx];
    if (!scene) return;
    stopWebcam();
    activeSceneIndex = idx;
    seqBeatAccumulator = 0;
    seqSecondAccumulator = 0;
    if (updateCueProgressBarFn) updateCueProgressBarFn(-1, 0);

    // 1. Apply visual source (API video, custom image/video, sample, Three.js 3D world, TD sample/palette, or WebGL generator)
    const src = scene.source || { kind: 'generator', genMode: 0, tdPaletteId: 'td_pal_plasma' };
    if (src.kind === 'api_video') {
      const apiItem = (window.__apiVideoCatalog && window.__apiVideoCatalog.find(v => v.id === src.sampleId)) || {
        id: src.sampleId || `api_vid_${idx}`,
        title: src.name || src.sourceName || scene.sourceName || 'API Video',
        fileName: src.sourceName || src.name || 'API Video',
        mediaType: 'video',
        isApiVideo: true,
        src: src.src || src.file,
        file: src.file || src.src,
        url: src.src || src.file,
        thumb: src.thumb || 'media/thumbs/tunnel.svg',
        theme: src.theme || 'galaxy'
      };
      loadSampleImage(apiItem, true);
    } else if (isCustomMediaSource(src)) {
      const customItem = ensureCustomMediaFromSource(src, scene.sourceName || scene.name);
      if (customItem) loadSampleImage(customItem, true);
    } else if (src.kind === 'sample' && src.sampleId) {
      const sample = sampleMediaList.find(s => s.id === src.sampleId) || customMediaList.find(s => s.id === src.sampleId);
      if (sample) loadSampleImage(sample, true);
    } else if (src.kind === 'three' && activeEngine !== 'td') {
      activateThreeWorld(Number(src.threeWorld) || 0, true);
    } else if (activeEngine === 'td') {
      if (src.kind === 'td_sample' && src.sampleId) {
        const item = tdNativeSamplesList.find(s => s.id === src.sampleId);
        if (item && midiBridge) {
          setActiveSampleThumb(item.id);
          updateSourceIndicator(item.mediaType, item.label);
          midiBridge.sendTdMedia({ source: item.source, mediaType: item.mediaType, mode: 'td_sample' });
        }
      } else {
        const pal = tdPaletteGeneratorsList.find(p => p.id === (src.tdPaletteId || 'td_pal_plasma')) || tdPaletteGeneratorsList[0];
        if (pal && midiBridge) {
          setActiveSampleThumb(pal.id);
          updateSourceIndicator('td_palette', `TD Gen: ${pal.label}`);
          midiBridge.sendTdMedia({ source: pal.source, mediaType: 'td_palette', mode: 'td_palette' });
        }
      }
    } else {
      const genMode = Number(src.genMode) || 0;
      document.querySelectorAll('[data-gen]').forEach(b => {
        b.classList.toggle('active', parseInt(b.getAttribute('data-gen'), 10) === genMode);
      });
      activateGenerativeMode(true);
      if (visualEngine) visualEngine.setParam('genMode', genMode);
    }
    if (isCustomMediaSource(src) || (src.kind === 'sample' && src.sampleId) || src.kind === 'api_video') {
      currentSourceSnapshot = { ...src, ...currentSourceSnapshot };
    } else {
      currentSourceSnapshot = { ...src };
    }

    // 2. Apply FX knobs (NEVER overwrite master BPM when 🔒 BPM Fijo is active!)
    if (scene.knobs) {
      Object.entries(scene.knobs).forEach(([kId, val]) => {
        if (kId === 'bpm' && bpmLocked) return;
        if (knobs[kId] && typeof val === 'number') {
          knobs[kId].setValue(val, true, 'scene');
        }
      });
    }

    // 3. Apply Color Preset Pad
    if (scene.color) {
      applyColorPresetByName(scene.color, true);
    }

    // 4. Apply Performance Pads state (Freeze, Invert, Pixel / CRT, Pulse) & send td_trigger
    const pads = scene.pads || {};
    isFrozen = Boolean(pads.freeze);
    if (btnFreeze) btnFreeze.classList.toggle('active', isFrozen);
    if (visualEngine) visualEngine.params.freeze = isFrozen;
    if (midiBridge) midiBridge.sendTdTrigger({ id: 'fx_freeze', action: 'fx_freeze', state: isFrozen, value: isFrozen ? 1 : 0 });

    isInverted = Boolean(pads.invert);
    if (btnInvert) btnInvert.classList.toggle('active', isInverted);
    if (visualEngine) visualEngine.params.invert = isInverted;
    if (midiBridge) midiBridge.sendTdTrigger({ id: 'master_invert', action: 'master_invert', state: isInverted, value: isInverted ? 1 : 0 });

    pixelCrtActive = Boolean(pads.pixelCrt);
    if (btnPixelCrt) btnPixelCrt.classList.toggle('active', pixelCrtActive);
    if (visualEngine) visualEngine.params.pixelCrt = pixelCrtActive;
    if (midiBridge) midiBridge.sendTdTrigger({ id: 'fx_pixel_crt', action: 'fx_pixel_crt', state: pixelCrtActive, value: pixelCrtActive ? 1 : 0 });

    pulseEnabled = Boolean(pads.pulse);
    if (btnPulseToggle) {
      btnPulseToggle.classList.toggle('active', pulseEnabled);
      btnPulseToggle.textContent = pulseEnabled ? '⚡ Pulse: ON' : '⚡ Pulse: OFF';
    }
    if (visualEngine) visualEngine.setPulseEnabled(pulseEnabled);
    if (midiBridge) midiBridge.sendTdTrigger({ id: 'master_pulse', action: 'master_pulse', state: pulseEnabled, value: pulseEnabled ? 1 : 0 });

    // 5. Restore Cue's custom 3D/2D Kinetic Text if defined on the scene
    if (typeof scene.kineticText === 'string' && typeof window.__setLiveKineticText === 'function') {
      window.__setLiveKineticText(scene.kineticText, false);
    }

    syncCueEditInputs(scene, origin !== 'name_edit');
    updateSeqStatusUI();
    if (origin !== 'seq' && origin !== 'assign') {
      showToast(
        activeEngine === 'td'
          ? `🎬 CUE ${idx + 1} (${scene.name || scene.sourceName || 'Custom'}) activado`
          : `🎬 CUE ${idx + 1} (${scene.name || scene.sourceName || 'Custom'}) · Cargado en motor WebGL`,
        'cyan',
        1400
      );
    }
  }

  function saveCue(cueIndex = activeSceneIndex) {
    const idx = Math.max(0, Math.min(7, Number(cueIndex) || 0));
    const activeColorBtn = document.querySelector('[data-col].active');
    const activeColor = activeColorBtn ? activeColorBtn.getAttribute('data-col') : 'original';

    // Capture ONLY the 11 effect/generator knobs (preserve master BPM outside scenes!)
    const knobSnapshot = {};
    knobList.forEach(k => {
      if (k.id !== 'bpm') knobSnapshot[k.id] = k.value;
    });

    const snap = currentSourceSnapshot ? { ...currentSourceSnapshot } : { kind: 'generator', genMode: 0, tdPaletteId: 'td_pal_plasma' };
    if (isCustomMediaSource(snap) && snap.sampleId) {
      const liveCustom = customMediaList.find(m => m.id === snap.sampleId);
      if (liveCustom) {
        snap.kind = 'custom_media';
        snap.mode = 'media';
        snap.isCustom = true;
        snap.name = liveCustom.title || snap.name;
        snap.sourceName = liveCustom.fileName || liveCustom.title || snap.sourceName;
        snap.mediaType = liveCustom.mediaType || snap.mediaType;
        if (liveCustom.dataUrl) snap.dataUrl = liveCustom.dataUrl;
        if (liveCustom.thumb) snap.thumb = liveCustom.thumb;
        if (liveCustom.uploadPath || liveCustom.serverPath) {
          snap.serverPath = liveCustom.uploadPath || liveCustom.serverPath;
          snap.file = snap.serverPath;
        }
        snap.src = snap.dataUrl || snap.serverPath || snap.file;
        if (liveCustom.absolutePath) snap.absolutePath = liveCustom.absolutePath;
      }
    }

    const resolvedSourceName = snap.sourceName || snap.name ||
      ((sourceLabel && sourceLabel.textContent)
        ? sourceLabel.textContent.replace(/^Foto:\s*|^Video:\s*|^TD Gen:\s*|^Modo Generativo\s*\((.+)\)$/i, '$1').trim()
        : `Cue ${idx + 1}`);

    const dur = Math.max(1, parseInt(inputCueDuration?.value, 10) || Number(showScenes[idx]?.duration) || 16);
    const unit = (selectCueDurationUnit?.value === 'seconds') ? 'seconds' : 'beats';
    const cueName = (inputCueName && inputCueName.value.trim()) ||
      (showScenes[idx] && showScenes[idx].name) ||
      `Cue ${idx + 1}`;
    const kineticTextEl = document.getElementById('kineticTextInput');
    const currentKineticText = kineticTextEl ? String(kineticTextEl.value || '') : (showScenes[idx]?.kineticText || '');

    showScenes[idx] = {
      name: cueName,
      sourceName: resolvedSourceName.slice(0, 22),
      duration: dur,
      durationUnit: unit,
      kineticText: currentKineticText,
      source: { ...snap, sourceName: resolvedSourceName },
      knobs: knobSnapshot,
      color: activeColor,
      pads: {
        freeze: isFrozen,
        invert: isInverted,
        pixelCrt: pixelCrtActive,
        pulse: pulseEnabled
      }
    };
    persistShowScenes();
    renderShowScenesGrid();
    syncCueEditInputs(showScenes[idx], true);
    updateSeqStatusUI();
    showToast(`💾 Guardado en CUE ${idx + 1}: "${cueName}" (${resolvedSourceName} · ${dur}${unit === 'seconds' ? 's' : 'B'})`, 'cyan');
  }

  applyShowSceneFn = applyShowScene;
  renderShowScenesGrid();
  syncCueEditInputs(showScenes[activeSceneIndex], true);
  updateSeqStatusUI();

  if (btnAutoShow) {
    btnAutoShow.addEventListener('click', () => {
      autoShowEnabled = !autoShowEnabled;
      autoShowEnergy = 0;
      autoShowBand = 'low';
      btnAutoShow.classList.toggle('active', autoShowEnabled);
      btnAutoShow.setAttribute('aria-pressed', String(autoShowEnabled));
      if (autoShowEnabled) {
        stopWebcam();
        applyShowScene(activeSceneIndex, 'seq');
      }
      updateSeqStatusUI();
      showToast(
        autoShowEnabled
          ? '🚀 Auto-Show activo: adaptando escenas y FX al nivel de energía de audio'
          : '🚀 Auto-Show desactivado',
        autoShowEnabled ? 'cyan' : 'info'
      );
    });
  }

  if (btnSeqPlay) {
    btnSeqPlay.addEventListener('click', () => {
      seqPlaying = !seqPlaying;
      seqBeatAccumulator = 0;
      seqSecondAccumulator = 0;
      if (!seqPlaying && updateCueProgressBarFn) updateCueProgressBarFn(-1, 0);
      btnSeqPlay.classList.toggle('active', seqPlaying);
      btnSeqPlay.textContent = seqPlaying ? '⏹ Stop' : '▶ Seq';
      if (seqPlaying) {
        stopWebcam();
        applyShowScene(activeSceneIndex, 'seq');
      }
      updateSeqStatusUI();
      const curCue = showScenes[activeSceneIndex];
      const durInfo = `${Math.max(1, Number(curCue?.duration) || 16)} ${curCue?.durationUnit === 'seconds' ? 'seg' : 'Beats'}`;
      showToast(
        seqPlaying
          ? `▶ Secuenciador en vivo (Cue ${activeSceneIndex + 1}: ${durInfo})`
          : '⏹ Secuenciador detenido',
        seqPlaying ? 'cyan' : 'info'
      );
    });
  }

  if (inputCueName) {
    inputCueName.addEventListener('input', () => {
      const sc = showScenes[activeSceneIndex];
      if (!sc) return;
      sc.name = inputCueName.value || `Cue ${activeSceneIndex + 1}`;
      updateCueCardDOM(activeSceneIndex);
      updateSeqStatusUI();
      persistShowScenes();
    });
    inputCueName.addEventListener('change', () => {
      const sc = showScenes[activeSceneIndex];
      if (!sc) return;
      const trimmed = inputCueName.value.trim() || `Cue ${activeSceneIndex + 1}`;
      sc.name = trimmed;
      inputCueName.value = trimmed;
      updateCueCardDOM(activeSceneIndex);
      updateSeqStatusUI();
      persistShowScenes();
    });
    inputCueName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        inputCueName.blur();
      }
    });
  }

  if (btnCueAssignMedia && cueMediaFileInput) {
    btnCueAssignMedia.addEventListener('click', () => cueMediaFileInput.click());
    cueMediaFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      cueMediaFileInput.value = '';
      if (!file) return;
      await assignMediaFileToCue(activeSceneIndex, file, { activateNow: true });
    });
  }

  function commitCurrentCueDuration() {
    const sc = showScenes[activeSceneIndex];
    if (!sc) return;
    sc.duration = Math.max(1, Math.min(999, parseInt(inputCueDuration?.value, 10) || 16));
    sc.durationUnit = (selectCueDurationUnit?.value === 'seconds') ? 'seconds' : 'beats';
    persistShowScenes();
    updateCueCardDOM(activeSceneIndex);
    updateSeqStatusUI();
  }

  if (inputCueDuration) {
    inputCueDuration.addEventListener('input', commitCurrentCueDuration);
    inputCueDuration.addEventListener('change', commitCurrentCueDuration);
  }
  if (selectCueDurationUnit) {
    selectCueDurationUnit.addEventListener('change', commitCurrentCueDuration);
  }

  if (btnSeqSave) {
    btnSeqSave.addEventListener('click', () => saveCue(activeSceneIndex));
  }

  // Export & Import Song Shows (.vortex.json)
  if (btnExportShow) {
    btnExportShow.addEventListener('click', () => {
      const nameInput = window.prompt('Nombre de la canción / Show a guardar:', currentShowName || 'Mi Show');
      if (nameInput === null) return;
      const showTitle = nameInput.trim() || 'Mi Show';
      currentShowName = showTitle;

      const masterBpmValue = knobs['bpm'] ? Number(knobs['bpm'].value) : currentBpm;
      const payload = {
        format: 'vortex-show-v1',
        showName: showTitle,
        exportedAt: new Date().toISOString(),
        masterBpm: masterBpmValue,
        beatMultiplier,
        waveShape,
        lfoTarget: lfoTargets[currentLfoTargetIdx]?.value || 'deform',
        customMedia: customMediaList.map(m => ({ ...m })),
        cues: showScenes.map(sc => JSON.parse(JSON.stringify(sc)))
      };

      const slug = showTitle.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'vortex-show';
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.vortex.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`📥 Show guardado: ${slug}.vortex.json (${Math.round(masterBpmValue)} BPM)`, 'cyan');
    });
  }

  if (btnImportShow && showFileInput) {
    btnImportShow.addEventListener('click', () => showFileInput.click());
    showFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      showFileInput.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || !Array.isArray(data.cues) || data.cues.length !== 8) {
          throw new Error('El archivo no contiene 8 Cues válidos');
        }

        if (data.showName) currentShowName = String(data.showName);

        // Restore custom images into gallery
        if (Array.isArray(data.customMedia)) {
          data.customMedia.forEach(item => {
            if (item && item.id) {
              const existing = customMediaList.find(m => m.id === item.id);
              if (!existing) {
                customMediaList.push({ ...item, isCustom: true });
              } else {
                Object.assign(existing, item, { isCustom: true });
              }
            }
          });
        }
        data.cues.forEach((sc, i) => {
          if (sc && sc.source && isCustomMediaSource(sc.source)) {
            ensureCustomMediaFromSource(sc.source, sc.sourceName || sc.name || `Cue ${i + 1}`);
          }
        });
        renderSampleGrid();

        // Restore exact Master BPM of the song + clock division/wave
        if (typeof data.masterBpm === 'number' && !Number.isNaN(data.masterBpm)) {
          const loadedBpm = Math.max(40, Math.min(200, Math.round(data.masterBpm)));
          currentBpm = loadedBpm;
          knobs['bpm']?.setValue(loadedBpm, true, 'show_load');
          if (visualEngine) visualEngine.setBPM(loadedBpm);
          if (bpmReadoutText) bpmReadoutText.textContent = `${loadedBpm} BPM`;
        }
        if (typeof data.beatMultiplier === 'number' && selectBeatDivision) {
          beatMultiplier = data.beatMultiplier;
          selectBeatDivision.value = String(beatMultiplier);
          if (visualEngine) visualEngine.setBeatMultiplier(beatMultiplier);
        }
        if (data.waveShape && selectWaveShape) {
          waveShape = String(data.waveShape);
          selectWaveShape.value = waveShape;
          if (visualEngine) visualEngine.setWaveShape(waveShape);
        }
        if (data.lfoTarget && btnLfoTarget) {
          const foundIdx = lfoTargets.findIndex(t => t.value === data.lfoTarget);
          if (foundIdx >= 0) {
            currentLfoTargetIdx = foundIdx;
            btnLfoTarget.textContent = lfoTargets[foundIdx].label;
            if (visualEngine) visualEngine.setLfoTarget(data.lfoTarget);
          }
        }

        showScenes = data.cues.map((sc, i) => ({
          ...FACTORY_SCENES[i],
          ...sc,
          name: (sc.name && String(sc.name).trim()) || FACTORY_SCENES[i].name,
          duration: Math.max(1, Number(sc.duration) || 16),
          durationUnit: sc.durationUnit === 'seconds' ? 'seconds' : 'beats'
        }));
        persistShowScenes();
        renderShowScenesGrid();
        applyShowScene(0, 'load');
        showToast(`📂 Show cargado: "${currentShowName}" (${Math.round(currentBpm)} BPM)`, 'cyan', 2600);
      } catch (err) {
        showToast(`Error cargando Show: ${err.message || 'archivo inválido'}`, 'warn');
      }
    });
  }

  // --- Emergency Visual Engine & Controls Reset (keeps music playing uninterrupted) ---
  function resetVisualsAndUnfreeze() {
    const trackEl = globalAudioEl || (visualEngine && visualEngine.audio && visualEngine.audio.element);
    const wasTrackPlaying = Boolean(trackEl && trackEl.src && !trackEl.paused && !trackEl.ended);

    // 1. Unfreeze & clear active lock states
    isFrozen = false;
    if (btnFreeze) btnFreeze.classList.remove('active');
    isInverted = false;
    if (btnInvert) btnInvert.classList.remove('active');
    pixelCrtActive = false;
    if (btnPixelCrt) btnPixelCrt.classList.remove('active');
    pulseEnabled = false;
    if (btnPulseToggle) {
      btnPulseToggle.classList.remove('active');
      btnPulseToggle.textContent = '⚡ Pulse: OFF';
    }

    // 2. Stop Auto-Show or Seq if they were overriding manual controls
    if (autoShowEnabled) {
      autoShowEnabled = false;
      autoShowEnergy = 0;
      if (btnAutoShow) {
        btnAutoShow.classList.remove('active');
        btnAutoShow.setAttribute('aria-pressed', 'false');
      }
    }
    if (seqPlaying) {
      seqPlaying = false;
      seqBeatAccumulator = 0;
      seqSecondAccumulator = 0;
      if (updateCueProgressBarFn) updateCueProgressBarFn(-1, 0);
      if (btnSeqPlay) {
        btnSeqPlay.classList.remove('active');
        btnSeqPlay.textContent = '▶ Seq';
      }
    }
    updateSeqStatusUI();

    // 3. Restore default visual knob values (preserving master BPM & Audio Sensitivity)
    const defaultKnobValues = {
      frequency: 0.35,
      detail: 0.50,
      speed: 0.40,
      camOrbit: 180,
      camZoom: 58,
      displace: 0.15,
      warpScale: 0.45,
      kaleido: 0.0,
      mirrorAngle: 0.0,
      feedback: 0.45,
      chroma: 0.20,
      hue: 0.0
    };
    Object.entries(defaultKnobValues).forEach(([id, val]) => {
      if (knobs[id]) knobs[id].setValue(val, true, 'reset');
    });

    // 4. Reset Media framing & color palette pad to Original
    resetMediaFraming();
    document.querySelectorAll('[data-col]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-col') === 'original');
    });

    // 5. Resume video if a video source was active
    if (currentVideoElement && currentVideoElement.paused && !mediaPausedState) {
      currentVideoElement.play().catch(() => {});
    }

    // 6. Reset WebGL & Three.js render engine loop and FBOs
    if (activeEngine === 'td') {
      sendCleanTdInitialSync();
    } else if (visualEngine) {
      if (glCanvas) glCanvas.style.display = 'block';
      if (typeof visualEngine.resetEngine === 'function') {
        visualEngine.resetEngine();
      } else {
        visualEngine.params.freeze = false;
        visualEngine.clearFBOs();
        visualEngine.start();
      }
    }

    // 7. Guarantee audio keeps playing without interruption
    ensureAudioContinuity(wasTrackPlaying);
    showToast('🔄 Motor visual y controles reseteados (música activa)', 'cyan', 2400);
  }

  if (btnResetVisuals) {
    btnResetVisuals.addEventListener('click', resetVisualsAndUnfreeze);
  }

  // --- Fullscreen & HUD Visibility Management ---
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  }

  if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);

  let isHudVisible = true;
  function toggleHUD(forceState = null) {
    isHudVisible = forceState !== null ? forceState : !isHudVisible;
    if (appHUD) appHUD.classList.toggle('hud--hidden', !isHudVisible);
    document.body.classList.toggle('ui-hidden', !isHudVisible);
  }

  if (btnToggleHUD) btnToggleHUD.addEventListener('click', () => toggleHUD());
  if (btnFloatingShowHUD) btnFloatingShowHUD.addEventListener('click', () => toggleHUD(true));

  // Keyboard Shortcuts (1..8 -> Escenas 1..8, H -> HUD, F -> Fullscreen, Space -> Flash)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (epilepsyModal && !epilepsyModal.hidden && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      if (btnAcceptEpilepsyModal) btnAcceptEpilepsyModal.click();
      return;
    }

    if (e.key === 'Escape' && tdModal && !tdModal.hidden) {
      tdModal.hidden = true;
      return;
    }

    if (e.key >= '1' && e.key <= '8') {
      if (activeEngine !== 'td') {
        applyShowScene(parseInt(e.key, 10) - 1, 'key');
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      toggleHUD();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    } else if ((e.key === 'r' || e.key === 'R') && e.shiftKey) {
      e.preventDefault();
      resetVisualsAndUnfreeze();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (visualEngine && visualEngine.sourceMode === 'three' && visualEngine.threeEngine && visualEngine.threeEngine.worldIndex === 1) {
        visualEngine.threeEngine.spawnRoadObject(true);
      }
      if (visualEngine) visualEngine.triggerBurst();
      if (btnBurstFlash) emitTdTriggerForButton(btnBurstFlash, true);
    }
  });

  const btnSpawnRoadObj = document.getElementById('btnSpawnRoadObj');
  if (btnSpawnRoadObj) {
    btnSpawnRoadObj.addEventListener('click', () => {
      if (!visualEngine || !visualEngine.threeEngine) return;
      if (visualEngine.sourceMode !== 'three' || visualEngine.threeEngine.worldIndex !== 1) {
        activateThreeWorld(1, true);
      }
      visualEngine.threeEngine.spawnRoadObject(true);
      if (typeof visualEngine.threeEngine.cycleBiome === 'function') {
        const nextBiomeName = visualEngine.threeEngine.cycleBiome(true);
        showToast(`🚗 Bioma: ${nextBiomeName || 'Transición'}`, 'cyan', 1600);
      } else {
        showToast('🚗 Objeto sorpresa generado en la carretera', 'cyan', 1400);
      }
    });
  }

  // =========================================================================
  // 🔤 LIVE 3D / 2D KINETIC TEXT + HYBRID CUE SELECTOR + CLOUD APIs (WEATHER & VIDEO)
  // =========================================================================
  const kineticTextInput = document.getElementById('kineticTextInput');
  const btnClearKineticText = document.getElementById('btnClearKineticText');
  const kineticOverlayCanvas = document.getElementById('kineticTextOverlayCanvas');
  const kineticOverlayCtx = kineticOverlayCanvas ? kineticOverlayCanvas.getContext('2d') : null;
  let liveKineticText = '';

  function setLiveKineticText(text = '', syncActiveCue = false) {
    const clean = String(text || '').slice(0, 72);
    liveKineticText = clean;
    if (kineticTextInput && kineticTextInput.value !== clean) {
      kineticTextInput.value = clean;
    }
    if (visualEngine && visualEngine.threeEngine && typeof visualEngine.threeEngine.setText3D === 'function') {
      visualEngine.threeEngine.setText3D(clean, 'extrude');
    }
    if (syncActiveCue && showScenes[activeSceneIndex]) {
      showScenes[activeSceneIndex].kineticText = clean;
      persistShowScenes();
    }
  }
  window.__setLiveKineticText = setLiveKineticText;

  if (kineticTextInput) {
    kineticTextInput.addEventListener('input', (e) => {
      setLiveKineticText(e.target.value, true);
    });
    kineticTextInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') kineticTextInput.blur();
    });
  }

  if (btnClearKineticText) {
    btnClearKineticText.addEventListener('click', () => {
      setLiveKineticText('', true);
      if (kineticTextInput) kineticTextInput.focus();
    });
  }

  const text3DFontSelect = document.getElementById('text3DFont');
  const text3DSizeInput = document.getElementById('text3DSize');
  const text3DColorInput = document.getElementById('text3DColor');
  const text3DBorderStyleSelect = document.getElementById('text3DBorderStyle');

  function update3DTextStyle() {
    const font = text3DFontSelect ? text3DFontSelect.value : 'Impact';
    const size = text3DSizeInput ? Math.max(10, Math.min(150, Number(text3DSizeInput.value))) : 60;
    const color = text3DColorInput ? text3DColorInput.value : '#ff0055';
    const borderStyle = text3DBorderStyleSelect ? text3DBorderStyleSelect.value : 'neon';
    if (visualEngine) {
      if (typeof visualEngine.setTextStyle === 'function') {
        visualEngine.setTextStyle(font, size, color, borderStyle);
      }
      if (visualEngine.threeEngine && typeof visualEngine.threeEngine.setTextStyle === 'function') {
        visualEngine.threeEngine.setTextStyle(font, size, color, borderStyle);
      }
    }
  }

  if (text3DFontSelect) {
    text3DFontSelect.addEventListener('change', update3DTextStyle);
  }
  if (text3DSizeInput) {
    text3DSizeInput.addEventListener('input', update3DTextStyle);
  }
  if (text3DColorInput) {
    text3DColorInput.addEventListener('input', update3DTextStyle);
    text3DColorInput.addEventListener('change', update3DTextStyle);
  }
  if (text3DBorderStyleSelect) {
    text3DBorderStyleSelect.addEventListener('change', () => {
      if (text3DColorInput) {
        if (text3DBorderStyleSelect.value === 'gold') text3DColorInput.value = '#fbbf24';
        else if (text3DBorderStyleSelect.value === 'cyan') text3DColorInput.value = '#00f0ff';
      }
      update3DTextStyle();
    });
  }

  // Render audio-reactive 2D kinetic typography over 2D Generators / Media (hidden automatically in 3D mode where Three.js renders true 3D text)
  function renderKineticText2DOverlay(now) {
    requestAnimationFrame(renderKineticText2DOverlay);
    if (!kineticOverlayCanvas || !kineticOverlayCtx) return;

    const inThreeMode = visualEngine && visualEngine.sourceMode === 'three';
    const shouldDraw = Boolean(liveKineticText.trim()) && !inThreeMode && activeEngine !== 'td';

    const targetW = window.innerWidth;
    const targetH = window.innerHeight;
    if (kineticOverlayCanvas.width !== targetW || kineticOverlayCanvas.height !== targetH) {
      kineticOverlayCanvas.width = targetW;
      kineticOverlayCanvas.height = targetH;
    }

    kineticOverlayCtx.clearRect(0, 0, targetW, targetH);
    if (!shouldDraw) return;

    const a = (visualEngine && visualEngine.audio) ? visualEngine.audio : { bass: 0, mid: 0, treble: 0 };
    const bass = Number(a.bass) || 0;
    const mid = Number(a.mid) || 0;
    const treble = Number(a.treble) || 0;
    const t = now * 0.001;

    const text = liveKineticText.trim().toUpperCase();
    let lines = [text];
    if (text.length > 12) {
      const mid = Math.floor(text.length / 2);
      let splitIdx = -1;
      let bestDist = 999;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ' && Math.abs(i - mid) < bestDist) {
          bestDist = Math.abs(i - mid);
          splitIdx = i;
        }
      }
      if (splitIdx > 2 && splitIdx < text.length - 2) {
        lines = [text.slice(0, splitIdx).trim(), text.slice(splitIdx + 1).trim()];
      }
    }

    const chosenFont = text3DFontSelect ? text3DFontSelect.value : 'Impact';
    const baseSize = text3DSizeInput ? Math.max(10, Math.min(150, Number(text3DSizeInput.value))) : 60;
    const chosenColor = text3DColorInput ? text3DColorInput.value : '#ff0055';
    const borderStyle = text3DBorderStyleSelect ? text3DBorderStyleSelect.value : 'neon';
    const pulseScale = 1.0 + bass * 0.28;
    const skewX = Math.sin(t * 2.8) * (0.04 + mid * 0.22);
    const rot = Math.cos(t * 1.9) * (0.02 + mid * 0.09);
    const glitchShift = (borderStyle === 'neon' && treble > 0.14) ? Math.sin(t * 32.0) * treble * 10 : 0;

    kineticOverlayCtx.save();
    kineticOverlayCtx.translate(targetW * 0.5, targetH * 0.44);
    kineticOverlayCtx.rotate(rot);
    kineticOverlayCtx.transform(pulseScale, 0, skewX, pulseScale, 0, 0);
    kineticOverlayCtx.font = `900 ${Math.round(baseSize)}px "${chosenFont}", sans-serif`;
    kineticOverlayCtx.textAlign = 'center';
    kineticOverlayCtx.textBaseline = 'middle';
    kineticOverlayCtx.lineJoin = 'round';
    kineticOverlayCtx.miterLimit = 2;

    const lineGap = baseSize * 1.15;
    const startY = lines.length === 2 ? -lineGap * 0.5 : 0;

    let fillColor = chosenColor;
    if (borderStyle === 'gold') {
      const goldGrad = kineticOverlayCtx.createLinearGradient(0, -baseSize * 0.7, 0, baseSize * 0.7);
      goldGrad.addColorStop(0, '#fef08a');
      goldGrad.addColorStop(0.5, '#f59e0b');
      goldGrad.addColorStop(1, '#b45309');
      fillColor = goldGrad;
    } else if (borderStyle === 'cyan') {
      const cyanGrad = kineticOverlayCtx.createLinearGradient(0, -baseSize * 0.7, 0, baseSize * 0.7);
      cyanGrad.addColorStop(0, '#67e8f9');
      cyanGrad.addColorStop(0.5, '#00f0ff');
      cyanGrad.addColorStop(1, '#0284c7');
      fillColor = cyanGrad;
    }

    for (let li = 0; li < lines.length; li++) {
      const ly = startY + li * lineGap;
      if (borderStyle === 'neon' && glitchShift !== 0) {
        kineticOverlayCtx.globalCompositeOperation = 'source-over';
        kineticOverlayCtx.shadowBlur = 0;
        kineticOverlayCtx.fillStyle = 'rgba(0, 240, 255, 0.35)';
        kineticOverlayCtx.fillText(lines[li], -2 - glitchShift, ly - 1);
        kineticOverlayCtx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        kineticOverlayCtx.fillText(lines[li], 2 + glitchShift, ly + 1);
      }

      kineticOverlayCtx.globalCompositeOperation = 'source-over';
      kineticOverlayCtx.shadowBlur = 0;
      kineticOverlayCtx.lineWidth = borderStyle === 'solid' ? 8 : 6;
      kineticOverlayCtx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      kineticOverlayCtx.strokeText(lines[li], 0, ly);

      if (borderStyle === 'neon') {
        kineticOverlayCtx.shadowColor = chosenColor;
        kineticOverlayCtx.shadowBlur = 8 + bass * 8;
      } else if (borderStyle === 'gold') {
        kineticOverlayCtx.shadowColor = 'rgba(245, 158, 11, 0.45)';
        kineticOverlayCtx.shadowBlur = 6;
      } else if (borderStyle === 'cyan') {
        kineticOverlayCtx.shadowColor = 'rgba(0, 240, 255, 0.45)';
        kineticOverlayCtx.shadowBlur = 6;
      } else {
        kineticOverlayCtx.shadowBlur = 0;
      }
      kineticOverlayCtx.fillStyle = fillColor;
      kineticOverlayCtx.fillText(lines[li], 0, ly);
    }
    kineticOverlayCtx.restore();
  }
  requestAnimationFrame(renderKineticText2DOverlay);

  // --- Hybrid Multi-Engine Cue Source Selector (#cueSourceTypeSelect) ---
  const cueSourceTypeSelect = document.getElementById('cueSourceTypeSelect');
  const cueMediaOptGroup = document.getElementById('cueMediaOptGroup');
  const apiVideoCatalog = [];
  window.__apiVideoCatalog = apiVideoCatalog;

  function refreshCueMediaOptGroup() {
    if (!cueMediaOptGroup) return;
    cueMediaOptGroup.innerHTML = '';
    sampleMediaList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = `sample:${s.id}`;
      opt.textContent = `🖼️ Media: ${s.title}`;
      cueMediaOptGroup.appendChild(opt);
    });
    customMediaList.forEach(m => {
      const opt = document.createElement('option');
      opt.value = `custom:${m.id}`;
      opt.textContent = `${m.mediaType === 'video' ? '🎬' : '🖼️'} Subido: ${(m.title || m.fileName || 'Custom').slice(0, 20)}`;
      cueMediaOptGroup.appendChild(opt);
    });
    apiVideoCatalog.forEach(v => {
      const opt = document.createElement('option');
      opt.value = `apivideo:${v.id}`;
      opt.textContent = `☁️ API Video: ${(v.title || 'Cloud').slice(0, 20)}`;
      cueMediaOptGroup.appendChild(opt);
    });
  }

  function sourceSnapshotToSelectValue(src) {
    if (!src) return '2d:0';
    if (src.kind === 'three') return `3d:${Math.max(0, Math.min(3, Number(src.threeWorld) || 0))}`;
    if (src.kind === 'api_video' && src.sampleId) return `apivideo:${src.sampleId}`;
    if (isCustomMediaSource(src) && src.sampleId) return `custom:${src.sampleId}`;
    if (src.kind === 'sample' && src.sampleId) return `sample:${src.sampleId}`;
    return `2d:${Math.max(0, Math.min(3, Number(src.genMode) || 0))}`;
  }

  window.__syncCueSourceSelect = (sceneOrSrc) => {
    if (!cueSourceTypeSelect) return;
    refreshCueMediaOptGroup();
    const src = (sceneOrSrc && sceneOrSrc.source) ? sceneOrSrc.source : sceneOrSrc;
    const val = sourceSnapshotToSelectValue(src);
    if ([...cueSourceTypeSelect.options].some(o => o.value === val)) {
      cueSourceTypeSelect.value = val;
    }
  };

  window.__syncCueSourceSelectFromCurrent = () => {
    window.__syncCueSourceSelect(currentSourceSnapshot);
  };

  if (cueSourceTypeSelect) {
    refreshCueMediaOptGroup();
    cueSourceTypeSelect.addEventListener('change', () => {
      const val = cueSourceTypeSelect.value || '2d:0';
      const colonIdx = val.indexOf(':');
      const kind = val.slice(0, colonIdx);
      const idPart = val.slice(colonIdx + 1);

      if (kind === '2d') {
        const genMode = Math.max(0, Math.min(3, parseInt(idPart, 10) || 0));
        document.querySelectorAll('[data-gen]').forEach(b => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-gen'), 10) === genMode);
        });
        activateGenerativeMode(true);
        if (visualEngine) visualEngine.setParam('genMode', genMode);
      } else if (kind === '3d') {
        const wIdx = Math.max(0, Math.min(3, parseInt(idPart, 10) || 0));
        activateThreeWorld(wIdx, false);
      } else if (kind === 'sample') {
        const sample = sampleMediaList.find(s => s.id === idPart);
        if (sample) loadSampleImage(sample, false);
      } else if (kind === 'custom') {
        const item = customMediaList.find(m => m.id === idPart);
        if (item) loadSampleImage(item, false);
      } else if (kind === 'apivideo') {
        const vid = apiVideoCatalog.find(v => v.id === idPart);
        if (vid) loadSampleImage(vid, false);
      }

      // Immediately update active Cue source & badge so sequential playback preserves hybrid switching
      if (showScenes[activeSceneIndex]) {
        showScenes[activeSceneIndex].source = { ...currentSourceSnapshot };
        showScenes[activeSceneIndex].sourceName = (currentSourceSnapshot.sourceName || currentSourceSnapshot.name || 'Cue').slice(0, 22);
        persistShowScenes();
        updateCueCardDOM(activeSceneIndex);
        updateSeqStatusUI();
      }
    });
  }

  // --- Cloud APIs Integration (Token Auth: Weather -> Visuals + Cloud Video Search) ---
  const weatherTokenInput = document.getElementById('weatherTokenInput');
  const giphyTokenInput = document.getElementById('giphyTokenInput');
  const apiTokenStatusPill = document.getElementById('apiTokenStatusPill');
  const apiWeatherCityInput = document.getElementById('apiWeatherCityInput');
  const btnSyncWeather = document.getElementById('btnSyncWeather');
  const weatherStatusBadge = document.getElementById('weatherStatusBadge');
  const apiVideoQueryInput = document.getElementById('apiVideoQueryInput');
  const btnSearchApiVideos = document.getElementById('btnSearchApiVideos');
  const apiVideoResultsGrid = document.getElementById('apiVideoResultsGrid');

  const WEATHER_TOKEN_STORAGE_KEY = 'vortex_weather_token_v1';
  const GIPHY_TOKEN_STORAGE_KEY = 'vortex_giphy_token_v1';

  const syncTokenStatusBadge = () => {
    const wTok = (weatherTokenInput && weatherTokenInput.value.trim()) || '';
    const gTok = (giphyTokenInput && giphyTokenInput.value.trim()) || '';
    try {
      localStorage.setItem(WEATHER_TOKEN_STORAGE_KEY, wTok);
      localStorage.setItem(GIPHY_TOKEN_STORAGE_KEY, gTok);
    } catch (e) { }
    if (apiTokenStatusPill) {
      if (wTok && gTok) {
        apiTokenStatusPill.textContent = '🟢 Clima + GIPHY Activos';
      } else if (wTok) {
        apiTokenStatusPill.textContent = `🟢 Clima Activo (${wTok.slice(0, 4)}···)`;
      } else if (gTok) {
        apiTokenStatusPill.textContent = `🟢 GIPHY Activo (${gTok.slice(0, 4)}···)`;
      } else {
        apiTokenStatusPill.textContent = '🟢 Token Activo (Bearer / AppID)';
      }
    }
  };

  [
    [weatherTokenInput, WEATHER_TOKEN_STORAGE_KEY],
    [giphyTokenInput, GIPHY_TOKEN_STORAGE_KEY]
  ].forEach(([inputEl, storageKey]) => {
    if (!inputEl) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) inputEl.value = saved;
    } catch (e) { }
    inputEl.addEventListener('input', syncTokenStatusBadge);
    inputEl.addEventListener('keydown', (e) => e.stopPropagation());
  });
  syncTokenStatusBadge();

  // Fallback procedural video stream if an external video host is unreachable offline
  window.__createFallbackApiVideoStream = (sample) => {
    try {
      const c = document.createElement('canvas');
      c.width = 640;
      c.height = 360;
      if (typeof c.captureStream !== 'function') return null;
      const ctx = c.getContext('2d');
      const theme = String((sample && sample.theme) || (sample && sample.title) || 'galaxy').toLowerCase();
      let raf = 0;
      let start = performance.now();

      const draw = (now) => {
        raf = requestAnimationFrame(draw);
        const t = (now - start) * 0.001;
        ctx.fillStyle = theme.includes('ocean') ? '#021526' : (theme.includes('neon') ? '#0c021f' : '#050614');
        ctx.fillRect(0, 0, c.width, c.height);

        for (let i = 0; i < 28; i++) {
          const p = i / 28;
          const x = c.width * 0.5 + Math.cos(t * (0.8 + p) + i * 0.6) * (70 + p * 210);
          const y = c.height * 0.5 + Math.sin(t * (1.1 + p * 0.5) + i * 0.9) * (40 + p * 120);
          const r = 10 + Math.sin(t * 2.5 + i) * 6 + p * 18;
          const hue = theme.includes('ocean') ? 185 + i * 2 : (theme.includes('neon') ? 290 + i * 4 : 210 + i * 5);
          ctx.fillStyle = `hsla(${hue % 360}, 95%, 62%, 0.48)`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(3, r), 0, Math.PI * 2);
          ctx.fill();
        }
      };
      raf = requestAnimationFrame(draw);

      const stream = c.captureStream(30);
      const video = document.createElement('video');
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.srcObject = stream;
      video._cleanupFallback = () => cancelAnimationFrame(raf);
      video.play().catch(() => { });
      return video;
    } catch (e) {
      return null;
    }
  };

  const weatherMiniBadge = document.getElementById('weatherMiniBadge');

  function updateWeatherMiniBadge(data, mode, modeEffectLabel, icon, temp, wind) {
    if (!weatherMiniBadge) return;
    const rawCity = String(data.city || 'LOC').trim();
    const cleanCity = rawCity.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
    const cityCode = (cleanCity || 'LOC').slice(0, 3).toUpperCase();
    const roundedTemp = Math.round(temp);

    weatherMiniBadge.textContent = `${icon} ${cityCode} ${roundedTemp}°C`;
    weatherMiniBadge.title = `${icon} Clima ${data.city || 'Local'}: ${temp}°C ${data.condition || ''} · 💨 ${wind} km/h -> ${modeEffectLabel}`;
    weatherMiniBadge.classList.remove('weather--heat', 'weather--snow');
    if (mode === 'heat') weatherMiniBadge.classList.add('weather--heat');
    else if (mode === 'snow') weatherMiniBadge.classList.add('weather--snow');
    weatherMiniBadge.style.display = 'inline-flex';
  }

  function applyWeatherVisualModulation(data) {
    if (!data) return;
    const temp = Number.isFinite(Number(data.temp)) ? Number(data.temp) : 22;
    const wind = Number.isFinite(Number(data.wind)) ? Number(data.wind) : 12;
    const cond = String(data.condition || '').toLowerCase();
    const weatherMain = String(data.weatherMain || (data.weather && data.weather[0] && data.weather[0].main) || '').toLowerCase();
    const explicitMode = String(data.mode || '').toLowerCase();

    // Clasificación fiel y precisa de la condición meteorológica real de OpenWeather
    let mode = 'clear';
    if (explicitMode && ['thunderstorm', 'rain', 'clouds', 'fog', 'clear', 'storm', 'heat', 'snow'].includes(explicitMode)) {
      if (explicitMode === 'storm') mode = 'thunderstorm';
      else if (explicitMode === 'heat') mode = 'clear';
      else mode = explicitMode;
    } else if (weatherMain === 'thunderstorm' || /torment|thunder|tempestad|rayo/i.test(cond)) {
      mode = 'thunderstorm';
    } else if (['rain', 'drizzle'].includes(weatherMain) || /lluv|rain|drizzle|chubasc|aguacer/i.test(cond)) {
      mode = 'rain';
    } else if (['mist', 'fog', 'haze', 'smoke', 'dust', 'sand', 'ash'].includes(weatherMain) || /niebl|fog|mist|bruma|haze/i.test(cond)) {
      mode = 'fog';
    } else if (weatherMain === 'clouds' || /nub|cloud|overcast|cubierto/i.test(cond)) {
      mode = 'clouds';
    } else if (weatherMain === 'clear' || /despej|clear|solead|sun|seren/i.test(cond)) {
      mode = 'clear';
    } else if (weatherMain === 'snow' || /niev|snow|hielo/i.test(cond) || temp <= 2) {
      mode = 'snow';
    } else {
      mode = temp >= 24 ? 'clear' : 'clouds';
    }

    const currentHour = new Date().getHours();
    const isDay = data.isDay !== undefined
      ? Boolean(data.isDay)
      : (data.is_day !== undefined
        ? Boolean(Number(data.is_day))
        : (currentHour >= 6 && currentHour < 19));

    if (visualEngine && visualEngine.threeEngine) {
      if (typeof visualEngine.threeEngine.applyWeather === 'function') {
        visualEngine.threeEngine.applyWeather({ ...data, mode, isDay, weatherMain });
      } else if (typeof visualEngine.threeEngine.setWeatherModulation === 'function') {
        visualEngine.threeEngine.setWeatherModulation({ ...data, mode, isDay, weatherMain });
      }
    }

    // Color preset: Cyberpunk o Infrared en día despejado
    const useInfrared = temp >= 26 && mode === 'clear' && isDay;
    applyColorPresetByName(useInfrared ? 'infrared' : 'cyberpunk', true);

    // Modulación sutil de SPEED por viento sin ensuciar la geometría ni tocar displace/chroma/warp/feedback
    const windRatio = Math.max(0, Math.min(1, wind / 42));
    const nextSpeed = Number((0.24 + windRatio * 0.45).toFixed(2));
    knobs['speed']?.setValue(nextSpeed, true, 'weather_api');

    const modeLabels = {
      clear: '☀️ Despejado (Cielo limpio, sol/luna nítidos, 0% lluvia)',
      clouds: '☁️ Nublado (Nubes volumétricas 3D, luz difusa suave, 0% lluvia)',
      fog: '🌫️ Neblina (Niebla atmosférica FogExp2, 0% lluvia)',
      rain: '🌧️ Lluvia (Lluvia 3D diagonal + charcos reflectantes en asfalto)',
      thunderstorm: '⛈️ Tormenta (Lluvia intensa + Relámpagos Bass)',
      snow: '❄️ Nieve Polar'
    };

    const icons = {
      clear: isDay ? '☀️' : '🌙',
      clouds: '☁️',
      fog: '🌫️',
      rain: '🌧️',
      thunderstorm: '⛈️',
      snow: '❄️'
    };

    const icon = icons[mode] || '🌤️';
    const modeEffectLabel = modeLabels[mode] || mode;
    updateWeatherMiniBadge(data, mode, modeEffectLabel, icon, temp, wind);

    if (weatherStatusBadge) {
      weatherStatusBadge.textContent = `${icon} ${data.city || 'Clima'}: ${temp}°C · ${data.condition || ''} · 💨 ${wind} km/h · ${data.tokenUsed ? `🔑 ${data.tokenUsed}` : 'Demo'}`;
    }
  }

  document.querySelectorAll('[data-weather-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-weather-preset');
      const presets = {
        storm: { city: 'Tormenta', temp: 16, wind: 36, humidity: 92, condition: 'Lluvia y Tormenta Eléctrica', mode: 'thunderstorm', weatherMain: 'Thunderstorm' },
        heat: { city: 'Cielo Despejado', temp: 28, wind: 14, humidity: 32, condition: 'Cielo Limpio y Soleado', mode: 'clear', weatherMain: 'Clear', isDay: true },
        snow: { city: 'Niebla / Nublado', temp: 18, wind: 12, humidity: 82, condition: 'Neblina y Nubes Bajas', mode: 'fog', weatherMain: 'Fog' }
      };
      const payload = presets[preset];
      if (!payload) return;
      applyWeatherVisualModulation(payload);
      showToast(`🌦️ Prueba de clima aplicada: ${payload.condition}`, 'cyan');
    });
  });

  async function fetchWeatherClientSideFallback(city, token) {
    const maskedToken = token
      ? (token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : token)
      : 'cloud-live';

    if (token && token.length >= 8) {
      try {
        const owmUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(token)}&units=metric&lang=es`;
        const owmRes = await fetch(owmUrl);
        if (owmRes.ok) {
          const owm = await owmRes.json();
          if (owm && owm.main) {
            return {
              ok: true,
              city: owm.name || city,
              temp: Math.round(Number(owm.main.temp) * 10) / 10,
              humidity: Number(owm.main.humidity) || 50,
              wind: Math.round((Number(owm.wind && owm.wind.speed) || 0) * 3.6 * 10) / 10,
              condition: (owm.weather && owm.weather[0] && owm.weather[0].description) || 'Despejado',
              weatherMain: (owm.weather && owm.weather[0] && owm.weather[0].main) || '',
              source: 'OpenWeatherMap API',
              tokenUsed: maskedToken
            };
          }
        }
      } catch (_) { }
    }

    try {
      const wttrRes = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      if (wttrRes.ok) {
        const wttr = await wttrRes.json();
        const cur = wttr && wttr.current_condition && wttr.current_condition[0];
        if (cur) {
          const descEs = (cur.lang_es && cur.lang_es[0] && cur.lang_es[0].value) ||
            (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) ||
            'Parcialmente nublado';
          const curDesc = (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) || '';
          let wMain = 'Clouds';
          if (/sunny|clear/i.test(curDesc) || /despej|sol/i.test(descEs)) wMain = 'Clear';
          else if (/thunder|torment/i.test(curDesc) || /thunder|torment/i.test(descEs)) wMain = 'Thunderstorm';
          else if (/rain|drizzle|shower/i.test(curDesc) || /lluv|chubasc/i.test(descEs)) wMain = 'Rain';
          else if (/fog|mist|haze/i.test(curDesc) || /niebl|bruma/i.test(descEs)) wMain = 'Fog';
          else if (/snow|blizzard/i.test(curDesc) || /niev/i.test(descEs)) wMain = 'Snow';
          return {
            ok: true,
            city,
            temp: Number(cur.temp_C) || 22,
            humidity: Number(cur.humidity) || 48,
            wind: Number(cur.windspeedKmph) || 12,
            condition: descEs,
            weatherMain: wMain,
            source: 'wttr.in Cloud Telemetry',
            tokenUsed: maskedToken
          };
        }
      }
    } catch (_) { }

    const cityPresets = {
      puebla: { temp: 24, wind: 14, humidity: 45, condition: 'Cielo despejado solar', weatherMain: 'Clear' },
      cdmx: { temp: 21, wind: 11, humidity: 52, condition: 'Nubosidad dispersa', weatherMain: 'Clouds' },
      monterrey: { temp: 31, wind: 22, humidity: 34, condition: 'Cálido despejado', weatherMain: 'Clear' },
      tokio: { temp: 13, wind: 19, humidity: 76, condition: 'Lluvia ligera neón', weatherMain: 'Rain' },
      reykjavik: { temp: 2, wind: 28, humidity: 84, condition: 'Frío polar y niebla', weatherMain: 'Fog' }
    };
    const preset = cityPresets[city.toLowerCase()] || { temp: 23, wind: 15, humidity: 50, condition: 'Brisa templada', weatherMain: 'Clear' };
    return {
      ok: true,
      city,
      ...preset,
      source: 'Cloud Weather Telemetry',
      tokenUsed: maskedToken
    };
  }

  async function syncWeatherFromApi() {
    const city = (apiWeatherCityInput && apiWeatherCityInput.value.trim()) || 'Puebla';
    const weatherTokenEl = document.getElementById('weatherTokenInput');
    const token = (weatherTokenEl && weatherTokenEl.value.trim()) || '';
    if (weatherStatusBadge) weatherStatusBadge.textContent = `⏳ Consultando clima de ${city}...`;

    try {
      let data = null;
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}&token=${encodeURIComponent(token)}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json && json.ok) data = json;
        }
      } catch (_) { }

      if (!data) {
        data = await fetchWeatherClientSideFallback(city, token);
      }

      applyWeatherVisualModulation(data);
      showToast(`☁️ Clima "${data.city}" (${data.temp}°C, ${data.condition}) transformando visuales`, 'cyan');
    } catch (err) {
      if (weatherStatusBadge) weatherStatusBadge.textContent = `⚠️ Error consultando clima: ${err.message}`;
      showToast(`Error API Clima: ${err.message}`, 'warn');
    }
  }

  if (btnSyncWeather) {
    btnSyncWeather.addEventListener('click', syncWeatherFromApi);
  }
  if (apiWeatherCityInput) {
    apiWeatherCityInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') syncWeatherFromApi();
    });
  }

  function activateApiVideoItem(item, cardEl = null) {
    if (!item) return;
    document.querySelectorAll('.api-video-card').forEach(c => c.classList.remove('active'));
    if (cardEl) cardEl.classList.add('active');
    loadSampleImage(item, false);
    currentSourceSnapshot = {
      kind: item.mediaType === 'image' ? 'custom_media' : 'api_video',
      mode: 'media',
      isApiVideo: item.mediaType !== 'image',
      sampleId: item.id,
      name: item.title,
      sourceName: item.title,
      mediaType: item.mediaType || 'video',
      src: item.url,
      file: item.url,
      thumb: item.thumb,
      theme: item.theme
    };
    refreshCueMediaOptGroup();
    window.__syncCueSourceSelectFromCurrent();
  }

  function renderApiVideoResults(videos = []) {
    if (!apiVideoResultsGrid) return [];
    apiVideoResultsGrid.innerHTML = '';
    const items = [];

    videos.forEach((entry, idx) => {
      const vid = typeof entry === 'string'
        ? {
          id: `giphy_${Date.now().toString(36)}_${idx}`,
          title: `${((apiVideoQueryInput && apiVideoQueryInput.value.trim()) || 'GIPHY').toUpperCase()} Clip #${idx + 1}`,
          url: entry
        }
        : (entry || {});
      if (!vid.url) return;

      const isGifImage = Boolean(vid.mediaType === 'image' || /\.gif(\?.*)?$/i.test(String(vid.url || '')));
      const item = {
        id: vid.id || `api_vid_${idx}`,
        title: vid.title || 'GIPHY MP4 Clip',
        fileName: vid.title || 'GIPHY MP4 Clip',
        mediaType: isGifImage ? 'image' : 'video',
        isApiVideo: !isGifImage,
        isCustom: isGifImage,
        src: vid.url,
        file: vid.url,
        url: vid.url,
        thumb: vid.thumb || 'media/thumbs/tunnel.svg',
        theme: vid.theme || 'cyberpunk'
      };

      const existingIdx = apiVideoCatalog.findIndex(v => v.id === item.id);
      if (existingIdx >= 0) apiVideoCatalog[existingIdx] = item;
      else apiVideoCatalog.push(item);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'api-video-card';
      card.title = `Cargar clip en WebGL (guardable en CUE 1..8): ${item.title}`;
      const thumbImg = document.createElement('img');
      thumbImg.className = 'api-video-thumb';
      thumbImg.src = item.thumb;
      thumbImg.alt = '';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'api-video-card-title';
      titleSpan.textContent = item.title;
      card.appendChild(thumbImg);
      card.appendChild(titleSpan);

      card.addEventListener('click', () => activateApiVideoItem(item, card));
      apiVideoResultsGrid.appendChild(card);
      items.push({ item, card });
    });
    refreshCueMediaOptGroup();
    return items;
  }

  async function searchCloudVideosFromApi() {
    const query = (apiVideoQueryInput && apiVideoQueryInput.value.trim()) || 'cyberpunk';
    const giphyTokenEl = document.getElementById('giphyTokenInput');
    const token = (giphyTokenEl && giphyTokenEl.value.trim()) || '';

    // Clear any previous error or status message in UI before processing/fetching
    if (apiVideoResultsGrid) {
      apiVideoResultsGrid.innerHTML = '';
    }

    // Support pasting a direct .mp4 / .webm / .gif URL straight onto the WebGL canvas
    if (/^https?:\/\/\S+/i.test(query) || /\.(mp4|webm|mov|gif)(\?.*)?$/i.test(query)) {
      const isGif = /\.gif(\?.*)?$/i.test(query);
      const directItem = {
        id: `direct_url_${Date.now().toString(36)}`,
        title: isGif ? '🎞️ GIF Directo URL' : '🎬 MP4 Directo URL',
        url: query,
        mediaType: isGif ? 'image' : 'video',
        thumb: isGif ? query : 'media/thumbs/tunnel.svg',
        theme: 'custom'
      };
      renderApiVideoResults([directItem]);
      const firstCard = apiVideoResultsGrid ? apiVideoResultsGrid.querySelector('.api-video-card') : null;
      activateApiVideoItem({
        ...directItem,
        fileName: directItem.title,
        isApiVideo: !isGif,
        isCustom: isGif,
        src: directItem.url,
        file: directItem.url
      }, firstCard);
      showToast(`🎬 URL directa cargada en el lienzo WebGL`, 'cyan');
      return;
    }

    if (apiVideoResultsGrid) {
      apiVideoResultsGrid.innerHTML = '<div style="font-size:8.5px;color:#94a3b8;">⏳ Buscando clips MP4 en GIPHY...</div>';
    }

    try {
      let result = null;
      try {
        const res = await fetch(`/api/videos?q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          result = await res.json();
        }
      } catch (_) { }

      // Cloud / GitHub Pages direct browser fallback when local /api/videos is not running
      if (!result || !result.videos || result.videos.length === 0) {
        const giphyKey = token || 'dc6zaTOxFJmzC';
        try {
          const gRes = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(giphyKey)}&q=${encodeURIComponent(query)}&limit=8&lang=es`);
          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData && Array.isArray(gData.data)) {
              const mp4s = gData.data.map(item => item.images?.original?.mp4 || item.images?.original_mp4?.mp4 || null).filter(Boolean);
              if (mp4s.length > 0) {
                result = { videos: mp4s, source: 'GIPHY Cloud API' };
              }
            }
          }
        } catch (_) { }
      }

      if (!result || !result.videos || result.videos.length === 0) {
        try {
          const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:video')}&gsrnamespace=6&gsrlimit=6&prop=videoinfo&viprop=url|derivatives|thumburl&viurlwidth=320&format=json&origin=*`;
          const wRes = await fetch(wikiUrl);
          if (wRes.ok) {
            const wData = await wRes.json();
            const pages = Object.values((wData && wData.query && wData.query.pages) || {});
            const wikiVideos = pages.map((p, idx) => {
              const vi = p.videoinfo && p.videoinfo[0];
              if (!vi) return null;
              const derivs = Array.isArray(vi.derivatives) ? vi.derivatives : [];
              const bestDeriv = derivs.find(d => /\.mp4|\.mov/i.test(String(d.src || ''))) || derivs[0];
              const playUrl = (bestDeriv && bestDeriv.src) || vi.url || '';
              if (!playUrl) return null;
              const cleanTitle = String(p.title || `Clip ${idx + 1}`).replace(/^File:/i, '').replace(/\.[^.]+$/, '').slice(0, 34);
              return {
                id: `wiki_${p.pageid || idx}`,
                title: `🎬 ${cleanTitle}`,
                url: playUrl,
                thumb: vi.thumburl || 'media/thumbs/tunnel.svg',
                theme: query.toLowerCase()
              };
            }).filter(Boolean);
            if (wikiVideos.length > 0) {
              result = { videos: wikiVideos, source: 'Wikimedia Cloud Video API' };
            }
          }
        } catch (_) { }
      }

      if (!result || !result.videos || result.videos.length === 0) {
        throw new Error("No se encontraron resultados MP4 en alta calidad.");
      }

      const videoUrl = result.videos[0];
      const rendered = renderApiVideoResults(result.videos);

      if (videoUrl) {
        if (rendered.length > 0) {
          activateApiVideoItem(rendered[0].item, rendered[0].card);
        } else {
          const resolvedUrl = typeof videoUrl === 'string' ? videoUrl : videoUrl.url;
          stopCurrentVideo();
          const videoEl = document.createElement('video');
          videoEl.crossOrigin = 'anonymous';
          videoEl.autoplay = true;
          videoEl.loop = true;
          videoEl.muted = true;
          videoEl.defaultMuted = true;
          videoEl.volume = 0;
          videoEl.playsInline = true;
          videoEl.src = resolvedUrl;
          videoEl.onloadeddata = () => {
            videoEl.muted = true;
            videoEl.play().catch(() => { });
            currentVideoElement = videoEl;
            if (visualEngine) visualEngine.setMedia(videoEl, 'video');
            resetMediaFraming();
          };
        }
      }

      showToast(`🎬 ${result.videos.length} clips MP4 cargados${result.source ? ` (${result.source})` : ''}`, 'cyan');
    } catch (err) {
      if (apiVideoResultsGrid) {
        apiVideoResultsGrid.innerHTML = '';
        const errDiv = document.createElement('div');
        errDiv.style.fontSize = '8.5px';
        errDiv.style.color = '#f87171';
        errDiv.textContent = `⚠️ ${err.message}`;
        apiVideoResultsGrid.appendChild(errDiv);
      }
      showToast(err.message, 'warn');
    }
  }

  if (btnSearchApiVideos) {
    btnSearchApiVideos.addEventListener('click', searchCloudVideosFromApi);
  }
  if (apiVideoQueryInput) {
    apiVideoQueryInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') searchCloudVideosFromApi();
    });
  }

  // Start cleanly in Generative Mode with Panel 1 100% enabled
  updateSourceIndicator('generator', 'Modo Generativo (Noise)');
  if (typeof window.__syncCueSourceSelect === 'function' && showScenes[activeSceneIndex]) {
    window.__syncCueSourceSelect(showScenes[activeSceneIndex]);
  }
  refreshMidiNoteBadges();

  console.log('⚡ [VORTEX] Modular Synthesizer & TouchDesigner Custom Deck initialized.');
})();
