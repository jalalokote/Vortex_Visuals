/**
 * VORTEX MODULAR HUD - Custom SVG + HTML Rotor Rotary Knob Component
 * Supports:
 * - Safari-safe centered HTML/CSS rotor indicator (-135deg to +135deg)
 * - Editable channel names (double-click label or click ✏️ icon) persisted in localStorage
 * - MIDI Learn & Purr Data UDP CC assignment
 */

class RotaryKnob {
  constructor(options) {
    this.id = options.id;
    this.defaultLabel = options.label || 'PARAM';
    this.defaultChannel = options.channelName || options.id || 'param';
    this.label = options.customLabel || this.defaultLabel;
    this.channelName = options.customChannel || this.label;

    this.category = options.category || 'gen'; // gen, mod, col, fx
    this.min = options.min !== undefined ? options.min : 0.0;
    this.max = options.max !== undefined ? options.max : 1.0;
    this.step = options.step !== undefined ? options.step : 0.01;
    this.defaultValue = options.value !== undefined ? options.value : 0.5;
    this.value = this.defaultValue;
    this.unit = options.unit || '';
    this.cc = options.cc !== undefined ? options.cc : null;
    this.channel = options.channel || 1;
    this.isArmedForMidi = false;

    this.onChange = options.onChange || (() => {});
    this.onMidiLearnArm = options.onMidiLearnArm || (() => {});
    this.onContextMenu = options.onContextMenu || null;
    this.onRename = options.onRename || (() => {});

    // Geometric constants for SVG Arc
    this.size = 76;
    this.cx = 38;
    this.cy = 38;
    this.r = 28;
    this.startAngle = -135; // degrees (bottom-left)
    this.endAngle = 135;    // degrees (bottom-right)
    this.totalAngle = 270;
    this.arcLength = 2 * Math.PI * this.r * (this.totalAngle / 360);

    this.container = null;
    this.titleRow = null;
    this.labelSpan = null;
    this.editBtn = null;
    this.trackArc = null;
    this.valueArc = null;
    this.rotorEl = null;
    this.readoutEl = null;
    this.ccBadge = null;

    this.isDragging = false;
    this.isEditingName = false;
    this.startY = 0;
    this.startVal = 0;

    this.initDOM();
    this.updateVisuals();
  }

  polarToCartesian(cx, cy, r, angleInDegrees) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians)
    };
  }

  describeArc(cx, cy, r, startAngle, endAngle) {
    const start = this.polarToCartesian(cx, cy, r, endAngle);
    const end = this.polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  }

  initDOM() {
    const wrapper = document.createElement('div');
    wrapper.className = `modular-knob modular-knob--${this.category}`;
    wrapper.id = `knob-wrapper-${this.id}`;
    wrapper.setAttribute('role', 'slider');
    wrapper.setAttribute('aria-label', this.label);
    wrapper.setAttribute('aria-valuemin', this.min);
    wrapper.setAttribute('aria-valuemax', this.max);
    wrapper.setAttribute('aria-valuenow', this.value);
    wrapper.tabIndex = 0;

    // Header: Editable Label & MIDI CC badge
    const header = document.createElement('div');
    header.className = 'knob-header';

    this.titleRow = document.createElement('div');
    this.titleRow.className = 'knob-title-row';

    this.labelSpan = document.createElement('span');
    this.labelSpan.className = 'knob-label';
    this.labelSpan.textContent = this.label;
    this.labelSpan.title = `Canal TD fijo: ${this.channelName || this.id}`;

    // Renaming disabled: channel IDs are fixed. Button kept hidden for layout/DOM compatibility.
    this.editBtn = document.createElement('button');
    this.editBtn.type = 'button';
    this.editBtn.className = 'knob-edit-btn';
    this.editBtn.textContent = '✏️';
    this.editBtn.hidden = true;
    this.editBtn.style.display = 'none';

    this.titleRow.appendChild(this.labelSpan);
    this.titleRow.appendChild(this.editBtn);

    this.ccBadge = document.createElement('span');
    this.ccBadge.className = 'knob-cc-badge';
    this.ccBadge.textContent = this.cc !== null ? `CC ${this.cc}` : 'Learn';
    this.ccBadge.title = 'Haz clic aquí para activar MIDI Learn en esta perilla (Clic derecho = borrar CC)';
    this.ccBadge.style.cursor = 'pointer';

    header.appendChild(this.titleRow);
    header.appendChild(this.ccBadge);
    wrapper.appendChild(header);

    // SVG Body + Centered HTML Rotor
    const svgWrap = document.createElement('div');
    svgWrap.className = 'knob-svg-wrap';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.size} ${this.size}`);
    svg.setAttribute('class', 'knob-svg');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="knob-glow-grad-${this.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--knob-accent-start, #06b6d4)" />
        <stop offset="100%" stop-color="var(--knob-accent-end, #8b5cf6)" />
      </linearGradient>
      <radialGradient id="knob-cap-grad-${this.id}" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="rgba(45, 52, 70, 0.95)" />
        <stop offset="70%" stop-color="rgba(18, 22, 32, 0.98)" />
        <stop offset="100%" stop-color="rgba(10, 12, 18, 1)" />
      </radialGradient>
      <filter id="knob-blur-${this.id}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="glow" />
        <feComposite in="SourceGraphic" in2="glow" operator="over" />
      </filter>
    `;
    svg.appendChild(defs);

    // Track Arc
    const trackD = this.describeArc(this.cx, this.cy, this.r, this.startAngle, this.endAngle);
    this.trackArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.trackArc.setAttribute('d', trackD);
    this.trackArc.setAttribute('class', 'knob-track');
    this.trackArc.setAttribute('fill', 'none');
    this.trackArc.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
    this.trackArc.setAttribute('stroke-width', '4');
    this.trackArc.setAttribute('stroke-linecap', 'round');
    svg.appendChild(this.trackArc);

    // Value Arc
    this.valueArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.valueArc.setAttribute('d', trackD);
    this.valueArc.setAttribute('class', 'knob-value-arc');
    this.valueArc.setAttribute('fill', 'none');
    this.valueArc.setAttribute('stroke', `url(#knob-glow-grad-${this.id})`);
    this.valueArc.setAttribute('stroke-width', '4');
    this.valueArc.setAttribute('stroke-linecap', 'round');
    this.valueArc.setAttribute('stroke-dasharray', `${this.arcLength} ${this.arcLength}`);
    this.valueArc.setAttribute('filter', `url(#knob-blur-${this.id})`);
    svg.appendChild(this.valueArc);

    // Inner Hardware Cap Circle
    const cap = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cap.setAttribute('cx', this.cx);
    cap.setAttribute('cy', this.cy);
    cap.setAttribute('r', '20');
    cap.setAttribute('class', 'knob-cap');
    cap.setAttribute('fill', `url(#knob-cap-grad-${this.id})`);
    cap.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
    cap.setAttribute('stroke-width', '1.2');
    svg.appendChild(cap);

    svgWrap.appendChild(svg);

    // HTML/CSS Centered Rotor for Safari-safe indicator rotation (-135deg to +135deg)
    this.rotorEl = document.createElement('div');
    this.rotorEl.className = 'knob-rotor';
    const tickEl = document.createElement('span');
    tickEl.className = 'knob-tick';
    this.rotorEl.appendChild(tickEl);
    svgWrap.appendChild(this.rotorEl);

    wrapper.appendChild(svgWrap);

    // Footer Readout Display
    const readoutWrap = document.createElement('div');
    readoutWrap.className = 'knob-readout-wrap';
    this.readoutEl = document.createElement('span');
    this.readoutEl.className = 'knob-readout';
    this.readoutEl.textContent = this.formatValue(this.value);
    readoutWrap.appendChild(this.readoutEl);
    wrapper.appendChild(readoutWrap);

    this.container = wrapper;
    this.bindEvents();
  }

  startInlineRename() {
    if (this.isEditingName) return;
    this.isEditingName = true;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'knob-rename-input';
    input.value = this.label;
    input.maxLength = 22;

    this.labelSpan.style.display = 'none';
    this.editBtn.style.display = 'none';
    this.titleRow.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      if (!this.isEditingName) return;
      this.isEditingName = false;
      const cleaned = input.value.trim();
      if (cleaned) {
        this.setCustomName(cleaned, true);
      }
      input.remove();
      this.labelSpan.style.display = '';
      this.editBtn.style.display = '';
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.isEditingName = false;
        input.remove();
        this.labelSpan.style.display = '';
        this.editBtn.style.display = '';
      }
    });

    input.addEventListener('blur', commit);
    input.addEventListener('mousedown', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  setCustomName(newName, notify = false) {
    const clean = String(newName || this.defaultLabel).trim() || this.defaultLabel;
    this.label = clean;
    this.channelName = clean;
    if (this.labelSpan) {
      this.labelSpan.textContent = clean;
    }
    if (this.container) {
      this.container.setAttribute('aria-label', clean);
    }
    if (notify) {
      this.onRename(this.id, clean, this);
    }
  }

  resetName() {
    this.label = this.defaultLabel;
    this.channelName = this.defaultChannel;
    if (this.labelSpan) {
      this.labelSpan.textContent = this.defaultLabel;
    }
    if (this.container) {
      this.container.setAttribute('aria-label', this.defaultLabel);
    }
  }

  formatValue(v) {
    if (this.unit === '°') return `${Math.round(v)}°`;
    if (this.unit === 'BPM') return `${Math.round(v)} BPM`;
    if (this.unit === 'x') return `${v.toFixed(1)}x`;
    if (this.max <= 1.0) return v.toFixed(2);
    if (this.max >= 100) return Math.round(v).toString();
    return v.toFixed(1);
  }

  getNormalized() {
    return Math.max(0, Math.min(1, (this.value - this.min) / (this.max - this.min)));
  }

  updateVisuals() {
    const norm = this.getNormalized();

    // Update SVG Progress Arc
    const dashoffset = this.arcLength * (1 - norm);
    this.valueArc.style.strokeDashoffset = dashoffset;

    // Update HTML Rotor Rotation (-135deg to +135deg around exact center)
    const currentAngle = this.startAngle + norm * this.totalAngle;
    if (this.rotorEl) {
      this.rotorEl.style.transform = `rotate(${currentAngle}deg)`;
    }

    // Update Readout Text & ARIA
    this.readoutEl.textContent = this.formatValue(this.value);
    this.container.setAttribute('aria-valuenow', this.value);

    // MIDI Badge Visuals
    if (this.isArmedForMidi) {
      this.ccBadge.classList.add('armed');
      this.ccBadge.textContent = 'LEARN...';
      this.container.classList.add('knob--armed');
    } else {
      this.ccBadge.classList.remove('armed');
      this.ccBadge.textContent = this.cc !== null ? `CC ${this.cc}` : 'Learn';
      this.container.classList.remove('knob--armed');
    }
  }

  setValue(newVal, triggerChange = true, source = 'internal') {
    const clamped = Math.max(this.min, Math.min(this.max, newVal));
    const stepped = Math.round(clamped / this.step) * this.step;
    const finalVal = parseFloat(stepped.toFixed(4));

    this.value = finalVal;
    this.updateVisuals();
    if (triggerChange) {
      this.onChange(this.value, this.getNormalized(), this, source);
    }
  }

  setNormalized(normVal, triggerChange = true, source = 'midi') {
    const clampedNorm = Math.max(0.0, Math.min(1.0, Number(normVal)));
    const val = this.min + clampedNorm * (this.max - this.min);
    this.setValue(val, triggerChange, source);
  }

  setMidiCC(ccNumber, channel = 1) {
    this.cc = ccNumber;
    this.channel = channel;
    this.isArmedForMidi = false;
    this.updateVisuals();
  }

  setArmed(state) {
    this.isArmedForMidi = state;
    this.updateVisuals();
  }

  bindEvents() {
    // Channel renaming (edit button / label double-click) removed: TD channel IDs stay fixed.

    // Direct click on CC / Learn badge arms this knob immediately for Web MIDI Learn
    if (this.ccBadge) {
      this.ccBadge.addEventListener('mousedown', (e) => e.stopPropagation());
      this.ccBadge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onMidiLearnArm(this, true);
      });
    }

    // Click for MIDI Learn when global mode is active
    this.container.addEventListener('click', () => {
      if (this.isEditingName) return;
      this.onMidiLearnArm(this, false);
    });

    // Mouse Drag (Vertical gesture standard)
    const onMouseDown = (e) => {
      if (e.button !== 0 || this.isEditingName) return;
      if (e.target === this.editBtn || e.target.classList.contains('knob-rename-input')) return;
      e.preventDefault();
      this.isDragging = true;
      this.startY = e.clientY;
      this.startVal = this.value;
      document.body.classList.add('knob-dragging-active');
      this.container.classList.add('active');

      const onMouseMove = (moveEvent) => {
        if (!this.isDragging) return;
        const deltaY = this.startY - moveEvent.clientY;
        const sensitivity = moveEvent.shiftKey ? 0.001 : 0.005;
        const range = this.max - this.min;
        const deltaVal = deltaY * sensitivity * range;
        this.setValue(this.startVal + deltaVal, true, 'ui');
      };

      const onMouseUp = () => {
        this.isDragging = false;
        document.body.classList.remove('knob-dragging-active');
        this.container.classList.remove('active');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    this.container.addEventListener('mousedown', onMouseDown);

    // Touch Drag (Mobile & Tablet multi-touch support)
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || this.isEditingName) return;
      this.isDragging = true;
      this.startY = e.touches[0].clientY;
      this.startVal = this.value;
      this.container.classList.add('active');
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      e.preventDefault();
      const deltaY = this.startY - e.touches[0].clientY;
      const sensitivity = 0.006;
      const range = this.max - this.min;
      const deltaVal = deltaY * sensitivity * range;
      this.setValue(this.startVal + deltaVal, true, 'ui');
    }, { passive: false });

    this.container.addEventListener('touchend', () => {
      this.isDragging = false;
      this.container.classList.remove('active');
    });

    // Right-click (clear MIDI mapping)
    this.container.addEventListener('contextmenu', (e) => {
      if (this.onContextMenu) {
        e.preventDefault();
        this.onContextMenu(this);
      }
    });

    // Double-click on SVG body to reset value to default
    const svgWrap = this.container.querySelector('.knob-svg-wrap');
    if (svgWrap) {
      svgWrap.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.setValue(this.defaultValue, true, 'ui');
      });
    }

    // Keyboard Accessibility (Arrows, PageUp/Down)
    this.container.addEventListener('keydown', (e) => {
      if (this.isEditingName) return;
      const step = e.shiftKey ? this.step * 5 : this.step;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.setValue(this.value + step, true, 'ui');
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.setValue(this.value - step, true, 'ui');
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.setValue(this.min, true, 'ui');
      } else if (e.key === 'End') {
        e.preventDefault();
        this.setValue(this.max, true, 'ui');
      }
    });

    // Mouse Wheel
    this.container.addEventListener('wheel', (e) => {
      if (this.isEditingName) return;
      e.preventDefault();
      const delta = Math.sign(e.deltaY) * -1;
      const step = e.shiftKey ? this.step * 0.2 : this.step * 1.5;
      this.setValue(this.value + delta * step, true, 'ui');
    }, { passive: false });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RotaryKnob;
} else {
  window.RotaryKnob = RotaryKnob;
}
