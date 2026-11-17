/**
 * VORTEX UDP / WEBSOCKET MIDI & TOUCHDESIGNER BRIDGE CONTROLLER
 *
 * 1. Recibe mensajes UDP desde Purr Data ([netsend -u] -> localhost:8080)
 *    retransmitidos por Node.js vía WebSocket como:
 *      { type: "midi_cc", cc: Number(cc), value: Number(value) }
 * 2. Retransmite en tiempo real todos los cambios de perillas (mouse o MIDI),
 *    triggers, medios y audio FFT hacia TouchDesigner:
 *      - { type: "td_control", id, channel, cc, value, scaledValue }
 *      - { type: "td_trigger", action, state }
 *      - { type: "td_media", source }
 *      - { type: "td_audio", bass, mid, treble, bpm }
 * 3. Soporta conexión simultánea al Hub local (ws://localhost:8080) y opcionalmente
 *    a un Web Server DAT directo de TouchDesigner (ej. ws://localhost:9980).
 */

class MidiAndBridgeController {
  constructor(options = {}) {
    this.knobs = new Map();          // knobId -> RotaryKnob
    this.ccMap = new Map();          // cc (Number) -> knobId
    this.storedByKnob = new Map();   // knobId -> cc (Number)
    this.isMidiLearnActive = false;
    this.armedKnob = null;

    // Primary Hub WebSocket (ws://localhost:8080 for Purr Data UDP + TD Hub)
    this.ws = null;
    this.wsUrl = options.wsUrl || 'ws://localhost:8080';
    this.isWsConnected = false;
    this.retryTimer = null;
    this.manualClose = false;

    // Optional Secondary Direct TD WebSocket (e.g. ws://localhost:9980)
    this.tdDirectWs = null;
    this.tdDirectUrl = '';
    this.isTdDirectConnected = false;

    const host = window.location.hostname;
    this.autoReconnect = window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '';

    this.cb = {
      activity: options.onMidiActivity || (() => {}),
      wsStatus: options.onWsStatusChange || (() => {}),
      learned: options.onLearnAssigned || options.onMidiLearned || (() => {}),
      tdTx: options.onTdTx || (() => {}),
      tdFrame: options.onTdFrame || (() => {})
    };

    this.loadStoredMappings();
    if (this.autoReconnect) {
      this.connectWebSocket(this.wsUrl);
    } else {
      this.cb.wsStatus('idle', this.wsUrl);
    }
  }

  // ------------------------------------------------------------ Mappings
  registerKnob(knob) {
    this.knobs.set(knob.id, knob);
    if (this.storedByKnob.has(knob.id)) {
      const cc = Number(this.storedByKnob.get(knob.id));
      knob.setMidiCC(cc);
      this.ccMap.set(cc, knob.id);
    } else if (knob.cc !== null && knob.cc !== undefined) {
      const cc = Number(knob.cc);
      if (!this.ccMap.has(cc)) {
        this.ccMap.set(cc, knob.id);
        knob.setMidiCC(cc);
      }
    }

    knob.onContextMenu = (instance) => {
      this.clearMapping(instance);
    };
  }

  loadStoredMappings() {
    try {
      const stored = JSON.parse(localStorage.getItem('vortex_udp_midi_mappings') || '[]');
      if (Array.isArray(stored)) {
        stored.forEach(({ knobId, cc }) => {
          if (knobId && cc !== null && cc !== undefined) {
            this.storedByKnob.set(knobId, Number(cc));
            this.ccMap.set(Number(cc), knobId);
          }
        });
      }
    } catch (e) {}
  }

  saveMappings() {
    try {
      const arr = [];
      this.ccMap.forEach((knobId, cc) => arr.push({ knobId, cc: Number(cc) }));
      localStorage.setItem('vortex_udp_midi_mappings', JSON.stringify(arr));
    } catch (e) {}
  }

  assignCC(knob, ccNumber) {
    const cc = Number(ccNumber);
    const previousOwnerId = this.ccMap.get(cc);
    if (previousOwnerId && previousOwnerId !== knob.id && this.knobs.has(previousOwnerId)) {
      this.knobs.get(previousOwnerId).setMidiCC(null);
    }
    this.ccMap.forEach((kId, existingCc) => {
      if (kId === knob.id) this.ccMap.delete(existingCc);
    });

    this.ccMap.set(cc, knob.id);
    knob.setMidiCC(cc);
    this.saveMappings();
    this.cb.learned(knob, cc);
  }

  clearMapping(knob) {
    this.ccMap.forEach((kId, cc) => {
      if (kId === knob.id) this.ccMap.delete(cc);
    });
    knob.setMidiCC(null);
    this.saveMappings();
  }

  resetDefaultMappings() {
    try { localStorage.removeItem('vortex_udp_midi_mappings'); } catch (e) {}
    this.ccMap.clear();
    this.storedByKnob.clear();
    let idx = 1;
    this.knobs.forEach((knob) => {
      this.ccMap.set(idx, knob.id);
      knob.setMidiCC(idx);
      idx++;
    });
  }

  // ------------------------------------------------------------ MIDI Learn
  toggleMidiLearn(force = null) {
    this.isMidiLearnActive = force !== null ? force : !this.isMidiLearnActive;
    if (!this.isMidiLearnActive && this.armedKnob) {
      this.armedKnob.setArmed(false);
      this.armedKnob = null;
    }
    return this.isMidiLearnActive;
  }

  armKnobForMidi(knob) {
    if (!this.isMidiLearnActive) return;
    if (this.armedKnob && this.armedKnob !== knob) {
      this.armedKnob.setArmed(false);
    }
    if (this.armedKnob === knob) {
      knob.setArmed(false);
      this.armedKnob = null;
    } else {
      this.armedKnob = knob;
      knob.setArmed(true);
    }
  }

  // ------------------------------------------------------------ Incoming CC Routing
  handleMidiCC(ccRaw, valueRaw, source = 'udp') {
    const cc = Number(ccRaw);
    const normValue = Math.max(0.0, Math.min(1.0, Number(valueRaw)));
    if (Number.isNaN(cc) || Number.isNaN(normValue)) return;

    this.cb.activity({ source, cc, value: normValue });

    // a) If MIDI Learn is active and a knob is waiting for assignment
    if (this.isMidiLearnActive && this.armedKnob) {
      const targetKnob = this.armedKnob;
      targetKnob.setArmed(false);
      this.armedKnob = null;
      this.assignCC(targetKnob, cc);
      targetKnob.setNormalized(normValue, true, source);
      return;
    }

    // b) Normal mode: find the knob assigned to this CC
    const knobId = this.ccMap.get(cc);
    const knob = knobId ? this.knobs.get(knobId) : null;
    if (knob) {
      knob.setNormalized(normValue, true, source);
    }
  }

  // ------------------------------------------------------------ WebSocket Connections
  connectWebSocket(url) {
    clearTimeout(this.retryTimer);
    const cleanUrl = (url || 'ws://localhost:8080').trim();

    // If user entered a custom port different from 8080 (e.g. ws://localhost:9980 for TD Web Server DAT),
    // keep 8080 connected for Purr Data UDP and also connect the secondary socket to the custom TD port!
    if (!cleanUrl.includes(':8080') && !cleanUrl.endsWith('/ws')) {
      this.connectDirectTdSocket(cleanUrl);
      if (!this.isWsConnected) {
        this._openPrimarySocket('ws://localhost:8080');
      }
      return;
    }

    this._openPrimarySocket(cleanUrl);
  }

  _openPrimarySocket(url) {
    if (this.ws) {
      this.manualClose = true;
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.manualClose = false;
    this.wsUrl = url;
    this.cb.wsStatus('connecting', url);

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.cb.wsStatus('disconnected', url);
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.isWsConnected = true;
      this.cb.wsStatus('connected', this.tdDirectUrl || url);
      this.send({ event: 'hello', client: 'vortex-web' });
    };

    ws.onmessage = (ev) => this.handleWsMessage(ev.data);
    ws.onerror = () => {};

    ws.onclose = () => {
      const wasConnected = this.isWsConnected;
      this.isWsConnected = false;
      if (this.ws === ws) this.ws = null;
      if (!this.isTdDirectConnected) {
        this.cb.wsStatus('disconnected', url);
      }

      if (!this.manualClose && this.autoReconnect) {
        this.retryTimer = setTimeout(() => {
          this._openPrimarySocket(this.wsUrl);
        }, wasConnected ? 1500 : 4000);
      }
    };
  }

  connectDirectTdSocket(url) {
    if (this.tdDirectWs) {
      try { this.tdDirectWs.close(); } catch (e) {}
      this.tdDirectWs = null;
    }
    this.tdDirectUrl = url;
    this.cb.wsStatus('connecting', url);

    try {
      const dws = new WebSocket(url);
      this.tdDirectWs = dws;
      dws.onopen = () => {
        this.isTdDirectConnected = true;
        this.cb.wsStatus('connected', url);
      };
      dws.onmessage = (ev) => this.handleWsMessage(ev.data);
      dws.onerror = () => {};
      dws.onclose = () => {
        this.isTdDirectConnected = false;
        if (this.tdDirectWs === dws) this.tdDirectWs = null;
        this.cb.wsStatus(this.isWsConnected ? 'connected' : 'disconnected', this.isWsConnected ? this.wsUrl : url);
      };
    } catch (e) {
      this.cb.wsStatus(this.isWsConnected ? 'connected' : 'disconnected', url);
    }
  }

  handleWsMessage(raw) {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed) return;

    let data = null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        data = JSON.parse(trimmed);
      } catch (e) {
        return;
      }
    } else {
      // Direct FUDI fallback: "<value> <cc>;" or "send <value> <cc>;"
      const clean = trimmed.replace(/;$/, '').replace(/^(send|list)\s+/i, '').trim();
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const v = parseFloat(parts[0]);
        const c = parseInt(parts[1], 10);
        if (!Number.isNaN(v) && !Number.isNaN(c)) {
          this.handleMidiCC(c, v, 'udp');
        }
      }
      return;
    }

    if (!data || typeof data !== 'object') return;

    // 1. Incoming frame from TouchDesigner over WebSocket (raw base64 JPEG or data URI)
    if (data.type === 'td_frame' && data.data) {
      const raw = String(data.data);
      const dataUri = raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
      this.cb.tdFrame(dataUri);
      return;
    }

    // 2. Primary UDP -> WS format from Purr Data: { type: "midi_cc", cc: Number(cc), value: Number(value) }
    if (data.type === 'midi_cc') {
      this.handleMidiCC(data.cc, data.value, 'udp');
      return;
    }

    // Ignore our own outbound td_* echoes if rebroadcasted
    if (
      data.type === 'td_control' ||
      data.type === 'td_trigger' ||
      data.type === 'td_media' ||
      data.type === 'td_audio' ||
      data.type === 'udp_bridge_ready' ||
      data.event === 'hello'
    ) {
      return;
    }

    // 3. Generic CC object: { cc: 1, value: 0.75 }
    if (data.cc !== undefined && data.cc !== null && data.param === undefined) {
      const v = parseFloat(data.value ?? data.val);
      if (!Number.isNaN(v)) {
        this.handleMidiCC(data.cc, v > 1 ? v / 127 : v, 'ws');
      }
      return;
    }

    // 4. Named parameter update from TD: { param: "frequency", value: 0.5 }
    if (data.param !== undefined) {
      const knob = this.knobs.get(String(data.param));
      if (knob) {
        const v = parseFloat(data.value ?? data.val);
        if (!Number.isNaN(v)) {
          if (v <= 1 && knob.max > 1) knob.setNormalized(v, true, 'ws');
          else knob.setValue(v, true, 'ws');
        }
      }
    }
  }

  send(obj) {
    const json = JSON.stringify(obj);
    if (this.isWsConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(json); } catch (e) {}
    }
    if (this.isTdDirectConnected && this.tdDirectWs && this.tdDirectWs.readyState === WebSocket.OPEN) {
      try { this.tdDirectWs.send(json); } catch (e) {}
    }
  }

  // ------------------------------------------------------------ Standardized TouchDesigner Protocol
  sendTdControl({ id, channel, cc, value, scaledValue }) {
    const packet = {
      type: 'td_control',
      id: id,
      channel: channel || id,
      cc: cc !== null && cc !== undefined ? Number(cc) : null,
      value: Number(Number(value).toFixed(4)),
      scaledValue: Number(Number(scaledValue).toFixed(4))
    };
    this.send(packet);
    this.cb.tdTx(packet);
  }

  sendTdTrigger({ action, id, state, value }) {
    const isActive = Boolean(state);
    const packet = {
      type: 'td_trigger',
      id: id || action,
      action: action || id,
      value: value !== undefined && value !== null ? value : (isActive ? 1 : 0),
      state: isActive
    };
    this.send(packet);
    this.cb.tdTx(packet);
  }

  sendTdMedia({ source, mediaType, mode, absolutePath }) {
    const packet = {
      type: 'td_media',
      source: source !== undefined && source !== null ? source : '',
      mediaType: mediaType || 'image',
      mode: mode || 'media'
    };
    if (absolutePath) packet.absolutePath = absolutePath;
    this.send(packet);
    this.cb.tdTx(packet);
  }

  sendTdAudio({ bass, mid, treble, bpm, beatEnvelope }) {
    const packet = {
      type: 'td_audio',
      bass: Number(Number(bass || 0).toFixed(4)),
      mid: Number(Number(mid || 0).toFixed(4)),
      treble: Number(Number(treble || 0).toFixed(4)),
      bpm: Number(bpm || 120),
      beat: Number(Number(beatEnvelope || 0).toFixed(4))
    };
    this.send(packet);
  }
}

window.MidiAndBridgeController = MidiAndBridgeController;
