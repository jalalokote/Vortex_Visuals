/**
 * VORTEX NATIVE WEB MIDI CONTROLLER (navigator.requestMIDIAccess)
 *
 * - Auto-conexión mediante la API nativa Web MIDI (navigator.requestMIDIAccess)
 *   compatible con HTTPS en GitHub Pages y localhost, sin depender de Purr Data ni WebSockets.
 * - Escucha el evento `midimessage` en todas las entradas (inputs) USB MIDI disponibles,
 *   abre explícitamente cada puerto (`input.open()`) y re-escanea automáticamente
 *   para capturar la inicialización asíncrona de CoreMIDI en macOS / Windows.
 * - Filtra mensajes Control Change (0xB0 / 176..191) y escala el valor de entrada
 *   (0 - 127) al rango normalizado 0.0 a 1.0 (`rawValue / 127`).
 * - Sistema de MIDI Learn unificado para Perillas (Knobs), Sliders de parámetros
 *   (Offset X, Offset Y, Zoom, Opacidad, Tamaño 3D) y Botones.
 */

class MidiAndBridgeController {
  constructor(options = {}) {
    this.knobs = new Map();          // knobId -> RotaryKnob
    this.params = new Map();         // paramId -> { id, label, element, learnBtn, min, max, step, onChange, cc }
    this.ccMap = new Map();          // cc (Number) -> targetId (knobId or paramId)
    this.storedByTarget = new Map(); // targetId -> cc (Number)

    this.isMidiLearnActive = false;
    this.armedKnob = null;
    this.armedParam = null;

    this.midiAccess = null;
    this.connectedDevices = [];
    this.isMidiConnected = false;
    this.scanPollTimer = null;
    this.midiSupported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';

    // Legacy compatibility flags (WebSockets disabled)
    this.isWsConnected = false;
    this.isTdDirectConnected = false;

    this.cb = {
      activity: options.onMidiActivity || (() => {}),
      midiStatus: options.onMidiStatusChange || (() => {}),
      wsStatus: options.onWsStatusChange || (() => {}),
      learned: options.onLearnAssigned || options.onMidiLearned || (() => {}),
      noteOn: options.onMidiNote || (() => {}),
      tdTx: options.onTdTx || (() => {}),
      tdFrame: options.onTdFrame || (() => {})
    };

    this.loadStoredMappings();
    this.initWebMidi();
    this.startAutoScanLoop();
  }

  // ------------------------------------------------------------ Auto-Conexión Web MIDI API
  async initWebMidi() {
    if (!this.midiSupported) {
      this.isMidiConnected = false;
      this.connectedDevices = [];
      this.cb.midiStatus({
        connected: false,
        supported: false,
        devices: [],
        message: 'Estado MIDI: No soportado (Usa Chrome/Edge)'
      });
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => {
        this.bindMidiInputs();
      };
      this.bindMidiInputs();

      // CoreMIDI en macOS a veces termina de poblar inputs unos milisegundos después de resolver requestMIDIAccess
      setTimeout(() => this.bindMidiInputs(), 150);
      setTimeout(() => this.bindMidiInputs(), 500);
      setTimeout(() => this.bindMidiInputs(), 1200);
      return true;
    } catch (err) {
      console.warn('[Web MIDI] Error o permiso pendiente inicializando Web MIDI:', err);
      this.isMidiConnected = false;
      this.connectedDevices = [];
      this.cb.midiStatus({
        connected: false,
        supported: true,
        devices: [],
        message: 'Estado MIDI: Desconectado (Haz clic aquí para activar)'
      });
      return false;
    }
  }

  startAutoScanLoop() {
    if (this.scanPollTimer) clearInterval(this.scanPollTimer);
    this.scanPollTimer = setInterval(() => {
      if (!this.midiAccess && this.midiSupported) {
        this.initWebMidi();
      } else if (this.midiAccess) {
        this.bindMidiInputs();
      }
    }, 2200);
  }

  bindMidiInputs() {
    if (!this.midiAccess) return;
    const deviceNames = [];

    for (const input of this.midiAccess.inputs.values()) {
      if (input.state !== 'disconnected') {
        const rawName = (input.name || input.manufacturer || 'Controlador MIDI USB').replace(/\s+/g, ' ').trim();
        // Si el nombre viene repetido como "WORLDE WORLDE", limpiarlo
        const parts = rawName.split(' ');
        const cleanName = (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase())
          ? parts[0]
          : rawName;

        deviceNames.push(cleanName);

        if (typeof input.open === 'function' && input.connection !== 'open') {
          try { input.open().catch(() => {}); } catch (_) {}
        }

        input.onmidimessage = (event) => this.handleRawMidiMessage(event, cleanName);
      } else {
        input.onmidimessage = null;
      }
    }

    this.connectedDevices = deviceNames;
    this.isMidiConnected = deviceNames.length > 0;

    const statusSummary = this.isMidiConnected
      ? `Estado MIDI: Conectado (${deviceNames.join(', ')})`
      : 'Estado MIDI: Desconectado';

    this.cb.midiStatus({
      connected: this.isMidiConnected,
      supported: true,
      devices: deviceNames,
      message: statusSummary
    });
  }

  // ------------------------------------------------------------ Procesamiento de Mensajes MIDI
  handleRawMidiMessage(event, deviceName = 'MIDI USB') {
    const data = event && event.data;
    if (!data || data.length < 2) return;

    // Si llega un mensaje MIDI y el indicador aún decía desconectado, marcar conectado de inmediato
    if (!this.isMidiConnected) {
      this.isMidiConnected = true;
      if (!this.connectedDevices.includes(deviceName)) {
        this.connectedDevices.push(deviceName);
      }
      this.cb.midiStatus({
        connected: true,
        supported: true,
        devices: this.connectedDevices,
        message: `Estado MIDI: Conectado (${this.connectedDevices.join(', ')})`
      });
    }

    const status = data[0];
    // Ignorar mensajes de reloj/sistema en tiempo real (0xF8..0xFF como Active Sensing 0xFE o Timing Clock 0xF8)
    if (status >= 0xf8) return;

    const command = status & 0xf0;
    const ccOrNote = data[1];
    const rawValue = data.length > 2 ? data[2] : 0;

    // 1. Filtrar mensajes de Control Change (CC: 0xB0 / 176..191 en cualquier canal MIDI 1..16)
    if (command === 0xb0) {
      // Escalar el valor de entrada (0 - 127) al rango normalizado 0.0 a 1.0 (equivalente a [/ 127])
      const normalizedValue = Math.max(0.0, Math.min(1.0, rawValue / 127.0));
      this.handleMidiCC(ccOrNote, normalizedValue, deviceName, rawValue);
      return;
    }

    // 2. Soporte adicional para Note On (0x90) con velocidad > 0 en caso de usar pads
    if (command === 0x90 && rawValue > 0) {
      this.cb.noteOn(ccOrNote, rawValue, deviceName);
    }
  }

  // ------------------------------------------------------------ Registro de Perillas y Sliders (Parámetros)
  registerKnob(knob) {
    this.knobs.set(knob.id, knob);
    if (this.storedByTarget.has(knob.id)) {
      const cc = Number(this.storedByTarget.get(knob.id));
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
      this.clearMapping(instance.id);
    };
  }

  registerParameter(config) {
    if (!config || !config.id) return null;
    const param = {
      id: config.id,
      label: config.label || config.id,
      element: config.element || null,
      learnBtn: config.learnBtn || null,
      min: config.min !== undefined ? Number(config.min) : 0.0,
      max: config.max !== undefined ? Number(config.max) : 1.0,
      step: config.step !== undefined ? Number(config.step) : 0.01,
      cc: config.cc !== undefined && config.cc !== null ? Number(config.cc) : null,
      isArmed: false,
      onChange: config.onChange || (() => {})
    };

    if (this.storedByTarget.has(param.id)) {
      const storedCc = Number(this.storedByTarget.get(param.id));
      param.cc = storedCc;
      this.ccMap.set(storedCc, param.id);
    } else if (param.cc !== null && !this.ccMap.has(param.cc)) {
      this.ccMap.set(param.cc, param.id);
    }

    this.params.set(param.id, param);
    this.updateParamLearnButtonUI(param);

    if (param.learnBtn) {
      param.learnBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.armParameterForMidi(param.id);
      });
      param.learnBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.clearMapping(param.id);
      });
    }

    return param;
  }

  updateParamLearnButtonUI(param) {
    if (!param || !param.learnBtn) return;
    const btn = param.learnBtn;
    if (param.isArmed) {
      btn.classList.add('armed');
      btn.classList.remove('mapped');
      btn.textContent = '⏳ CC...';
      btn.title = `Esperando movimiento de CC en tu controlador MIDI para "${param.label}" (clic para cancelar)`;
    } else if (param.cc !== null && param.cc !== undefined) {
      btn.classList.remove('armed');
      btn.classList.add('mapped');
      btn.textContent = `CC ${param.cc}`;
      btn.title = `Controlado por MIDI CC #${param.cc} (${param.label}). Clic para reasignar · Clic derecho para borrar.`;
    } else {
      btn.classList.remove('armed', 'mapped');
      btn.textContent = 'Learn';
      btn.title = `Activar MIDI Learn para "${param.label}"`;
    }
  }

  // ------------------------------------------------------------ Persistencia de Mapeos MIDI CC
  loadStoredMappings() {
    try {
      const raw = localStorage.getItem('vortex_webmidi_cc_mappings_v1') || localStorage.getItem('vortex_udp_midi_mappings') || '[]';
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        stored.forEach(({ targetId, knobId, cc }) => {
          const id = targetId || knobId;
          if (id && cc !== null && cc !== undefined) {
            this.storedByTarget.set(id, Number(cc));
            this.ccMap.set(Number(cc), id);
          }
        });
      }
    } catch (e) {}
  }

  saveMappings() {
    try {
      const arr = [];
      this.ccMap.forEach((targetId, cc) => arr.push({ targetId, knobId: targetId, cc: Number(cc) }));
      localStorage.setItem('vortex_webmidi_cc_mappings_v1', JSON.stringify(arr));
    } catch (e) {}
  }

  assignCC(targetOrId, ccNumber) {
    const cc = Number(ccNumber);
    const targetId = typeof targetOrId === 'string' ? targetOrId : (targetOrId && targetOrId.id);
    if (!targetId || Number.isNaN(cc)) return;

    // Si otro control tenía este CC, liberarlo primero
    const previousOwnerId = this.ccMap.get(cc);
    if (previousOwnerId && previousOwnerId !== targetId) {
      if (this.knobs.has(previousOwnerId)) {
        this.knobs.get(previousOwnerId).setMidiCC(null);
      }
      if (this.params.has(previousOwnerId)) {
        const prevParam = this.params.get(previousOwnerId);
        prevParam.cc = null;
        this.updateParamLearnButtonUI(prevParam);
      }
    }

    // Eliminar cualquier CC anterior asociado a este mismo control
    this.ccMap.forEach((existingTargetId, existingCc) => {
      if (existingTargetId === targetId) this.ccMap.delete(existingCc);
    });

    this.ccMap.set(cc, targetId);
    this.storedByTarget.set(targetId, cc);

    if (this.knobs.has(targetId)) {
      const knob = this.knobs.get(targetId);
      knob.setMidiCC(cc);
      this.saveMappings();
      this.cb.learned({ id: knob.id, label: knob.label, channelName: knob.channelName, type: 'knob' }, cc);
    } else if (this.params.has(targetId)) {
      const param = this.params.get(targetId);
      param.cc = cc;
      param.isArmed = false;
      this.updateParamLearnButtonUI(param);
      this.saveMappings();
      this.cb.learned({ id: param.id, label: param.label, channelName: param.label, type: 'param' }, cc);
    }
  }

  clearMapping(targetOrId) {
    const targetId = typeof targetOrId === 'string' ? targetOrId : (targetOrId && targetOrId.id);
    if (!targetId) return;

    this.ccMap.forEach((existingId, cc) => {
      if (existingId === targetId) this.ccMap.delete(cc);
    });
    this.storedByTarget.delete(targetId);

    if (this.knobs.has(targetId)) {
      this.knobs.get(targetId).setMidiCC(null);
    }
    if (this.params.has(targetId)) {
      const param = this.params.get(targetId);
      param.cc = null;
      param.isArmed = false;
      this.updateParamLearnButtonUI(param);
    }
    this.saveMappings();
  }

  resetDefaultMappings() {
    try {
      localStorage.removeItem('vortex_webmidi_cc_mappings_v1');
      localStorage.removeItem('vortex_udp_midi_mappings');
    } catch (e) {}
    this.ccMap.clear();
    this.storedByTarget.clear();
    let idx = 1;
    this.knobs.forEach((knob) => {
      this.ccMap.set(idx, knob.id);
      knob.setMidiCC(idx);
      idx++;
    });
    this.params.forEach((param) => {
      param.cc = null;
      param.isArmed = false;
      this.updateParamLearnButtonUI(param);
    });
  }

  // ------------------------------------------------------------ Sistema MIDI Learn (Perillas + Sliders)
  disarmAllTargets() {
    if (this.armedKnob) {
      this.armedKnob.setArmed(false);
      this.armedKnob = null;
    }
    if (this.armedParam) {
      this.armedParam.isArmed = false;
      this.updateParamLearnButtonUI(this.armedParam);
      this.armedParam = null;
    }
  }

  toggleMidiLearn(force = null) {
    this.isMidiLearnActive = force !== null ? force : !this.isMidiLearnActive;
    if (!this.isMidiLearnActive) {
      this.disarmAllTargets();
    }
    return this.isMidiLearnActive;
  }

  armKnobForMidi(knob, forceDirectLearn = false) {
    if (!this.isMidiLearnActive && !forceDirectLearn) return;
    if (forceDirectLearn) {
      this.isMidiLearnActive = true;
    }

    const wasSameKnob = this.armedKnob === knob;
    this.disarmAllTargets();

    if (!wasSameKnob && knob) {
      this.armedKnob = knob;
      knob.setArmed(true);
    }
  }

  armParameterForMidi(paramId) {
    const param = this.params.get(paramId);
    if (!param) return false;

    const wasArmed = param.isArmed && this.armedParam === param;
    this.disarmAllTargets();

    if (wasArmed) {
      this.isMidiLearnActive = false;
      return false;
    }

    this.isMidiLearnActive = true;
    param.isArmed = true;
    this.armedParam = param;
    this.updateParamLearnButtonUI(param);
    return true;
  }

  applyNormalizedToParam(param, normValue, source = 'midi') {
    if (!param) return;
    const clampedNorm = Math.max(0.0, Math.min(1.0, Number(normValue)));
    const rawScaled = param.min + clampedNorm * (param.max - param.min);
    const stepped = param.step ? Math.round(rawScaled / param.step) * param.step : rawScaled;
    const finalVal = Number(stepped.toFixed(4));

    if (param.element) {
      param.element.value = String(finalVal);
      param.element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    param.onChange(finalVal, clampedNorm, param, source);
  }

  // ------------------------------------------------------------ Ruteo de CC Entrante (0.0 .. 1.0)
  handleMidiCC(ccRaw, valueRaw, source = 'Web MIDI', raw7Bit = null) {
    const cc = Number(ccRaw);
    const normValue = Math.max(0.0, Math.min(1.0, Number(valueRaw)));
    if (Number.isNaN(cc) || Number.isNaN(normValue)) return;

    this.cb.activity({ source, cc, value: normValue, raw: raw7Bit });

    // a) Si hay un Slider/Parámetro esperando MIDI Learn
    if (this.armedParam) {
      const targetParam = this.armedParam;
      this.armedParam = null;
      targetParam.isArmed = false;
      this.isMidiLearnActive = false;
      this.assignCC(targetParam.id, cc);
      this.applyNormalizedToParam(targetParam, normValue, source);
      return;
    }

    // b) Si hay una Perilla (Knob) esperando MIDI Learn
    if (this.armedKnob) {
      const targetKnob = this.armedKnob;
      this.armedKnob = null;
      targetKnob.setArmed(false);
      this.isMidiLearnActive = false;
      this.assignCC(targetKnob.id, cc);
      targetKnob.setNormalized(normValue, true, source);
      return;
    }

    // c) Modo normal: buscar el control (Perilla o Slider) asignado a este CC
    const targetId = this.ccMap.get(cc);
    if (!targetId) return;

    if (this.knobs.has(targetId)) {
      this.knobs.get(targetId).setNormalized(normValue, true, source);
    } else if (this.params.has(targetId)) {
      this.applyNormalizedToParam(this.params.get(targetId), normValue, source);
    }
  }

  // Métodos de compatibilidad sin operación de red (WebSockets eliminados)
  connectWebSocket() {}
  send() {}
  sendTdControl(payload) { this.cb.tdTx({ type: 'td_control', ...payload }); }
  sendTdTrigger(payload) { this.cb.tdTx({ type: 'td_trigger', ...payload }); }
  sendTdMedia(payload) { this.cb.tdTx({ type: 'td_media', ...payload }); }
  sendTdAudio() {}
}

window.MidiAndBridgeController = MidiAndBridgeController;
