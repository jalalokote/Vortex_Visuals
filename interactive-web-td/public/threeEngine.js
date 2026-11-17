/**
 * VORTEX THREE.JS ENGINE — 4 Infinite Ordered 3D Ecosystems + Object-to-Object Interaction + Live 3D Kinetic Typography
 *
 *   0 ('aquarium')  : 🐟 Bio-Aquarium 3D (Abyssal FogExp2 + Volumetric Caustics + Infinite Seabed + Bioluminescent Attractor Orbs + 300 Schooling Fish + 15 Mantas + 35 Jellyfish with Manta Avoidance)
 *   1 ('cyber')     : 🌐 Cyber World 3D  (Synthwave Segmented Sun + Twilight Sky + Infinite Treadmill Wireframe Terrain + 160 Ordered FFT Skyscrapers + 24 Light-Trail Drones dodging growing towers)
 *   2 ('mycelium')  : 🌿 Bio-Mycelium 3D (Infinite Organic Tunnel of Toroidal Root Rings + Golden-Spiral Synaptic Nodes + Traveling Light Impulses that excite nodes and fire branch filaments)
 *   3 ('cathedral') : 🏛️ Mirror Cathedral 3D (Infinite Sacred Geometry Corridor + Monumental Arches + 120 Specular Crystal Pillars in Domino Wave + Interlocking BPM Gyroscopic Core Rings + Reflected Light Beams)
 *
 * Performance & Architecture:
 * - Fixed 960x540 internal canvas uploaded as a WebGL texture into the main post-FX pipeline.
 * - Zero per-frame allocations: all InstancedMesh transforms reuse pre-allocated scratch Object3D/Vector3/Color instances.
 * - Live 3D Kinetic Text (`setText3D(text, mode)`): 8 parallel extruded 3D layers driven by a dynamic 2D canvas, reacting to bass (Z extrusion), mid (3D wave tilt), and treble (neon glitch split).
 */

class ThreeVisualEngine {
  constructor(options = {}) {
    this.width = options.width || 960;
    this.height = options.height || 540;
    this.onCameraReset = options.onCameraReset || null;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.ok = false;
    this.active = false;
    this.autoFlight = true;
    this.worldIndex = 0;
    this.worldKeys = ['aquarium', 'cyber', 'mycelium', 'cathedral'];
    this.worldNames = [
      'Aquarium 3D',
      'Endless Drive 3D',
      'Bio-Terra 3D',
      'Catedral / LiDAR 3D'
    ];
    this.steerInput = 0;
    this.lastRoadSpawnTime = -10;

    this.time = 0;
    this.flightPhase = 0;
    this.smoothEnergy = 0;
    this.prevBass = 0;
    this.lastShockTime = -10;
    this.lastOrbSpawnTime = -10;
    this.lastImpulseSpawnTime = -10;
    this.shockwaveProgress = 1.0;
    this.shockIntensity = 0.0;

    // Weather API modulation state
    this.weatherMod = {
      active: false,
      temp: 22,
      wind: 10,
      fogMultiplier: 1.0,
      warmth: 0.5 // 0 = cold cyan/ocean, 1 = warm infrared/solar
    };

    // Camera user offsets (combined with Auto-Viaje 3D)
    this.userCamTarget = { orbitX: 0, y: 0, zOffset: 0 };
    this.userCamCurrent = { orbitX: 0, y: 0, zOffset: 0 };

    // Mouse / Pointer interaction
    this.pointer = { x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
    this.keys = Object.create(null);

    // 3D Kinetic Text state
    this.kineticText = '';
    this.kineticTextMode = 'extrude';
    this.text3DFont = 'Impact';
    this.text3DSize = 60;
    this.text3DColor = '#ff0055';
    this.text3DBorderStyle = 'neon';
    this.externalAudio = null;

    // CC 11 ANGLE / Morphing parameter
    this.morphAngle = 0;

    // Day/Night cycle state (6h - 19h = Day)
    const initialHour = new Date().getHours();
    this.isDay = initialHour >= 6 && initialHour < 19;

    if (typeof THREE === 'undefined') {
      console.warn('[ThreeVisualEngine] THREE no está cargado.');
      return;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.outputEncoding = THREE.sRGBEncoding;

      this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 700);

      // Pre-allocated scratch math objects (zero GC inside renderFrame)
      this._dummy = new THREE.Object3D();
      this._vecA = new THREE.Vector3();
      this._vecB = new THREE.Vector3();
      this._vecC = new THREE.Vector3();
      this._vecD = new THREE.Vector3();
      this._autoPos = new THREE.Vector3();
      this._autoLook = new THREE.Vector3();
      this._finalLook = new THREE.Vector3();
      this._colorA = new THREE.Color();
      this._colorB = new THREE.Color();

      this.glowTexture = this._createGlowSpriteTexture();
      this._initKineticText3DSystem();
      this._initWeatherSystem();

      this.worlds = [
        this._buildAquariumWorld(),
        this._buildCyberWorld(),
        this._buildMyceliumWorld(),
        this._buildCathedralWorld()
      ];

      // Attach 3D text rig, weather particle rig & volumetric clouds to initial world
      if (this.worlds[0]) {
        if (this.text3DGroup) this.worlds[0].scene.add(this.text3DGroup);
        if (this.weatherGroup) this.worlds[0].scene.add(this.weatherGroup);
        if (this.cloudsGroup) this.worlds[0].scene.add(this.cloudsGroup);
      }

      this._bindControls();
      this.resetCamera(false);
      this.ok = true;
    } catch (err) {
      console.error('[ThreeVisualEngine] Error inicializando WebGLRenderer:', err);
      this.ok = false;
    }
  }

  // ============================================================================
  // SHARED TEXTURES, SKYDOME & KINETIC 3D TEXT SYSTEM
  // ============================================================================
  _createGlowSpriteTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.28, 'rgba(160, 245, 255, 0.85)');
    grad.addColorStop(0.65, 'rgba(0, 190, 255, 0.25)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  _createSkyDome(palette) {
    const geo = new THREE.SphereGeometry(520, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uWarmth: { value: 0.0 },
        uTopColor: { value: new THREE.Color(palette.top) },
        uHorizonColor: { value: new THREE.Color(palette.horizon) },
        uBottomColor: { value: new THREE.Color(palette.bottom) },
        uAccentColor: { value: new THREE.Color(palette.accent) }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uWarmth;
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uAccentColor;
        varying vec3 vWorldPos;

        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = dir.y;
          vec3 col = y >= 0.0
            ? mix(uHorizonColor, uTopColor, pow(y, 0.55))
            : mix(uHorizonColor, uBottomColor, pow(-y, 0.65));

          float band1 = sin(dir.x * 5.0 + uTime * 0.45 + sin(dir.z * 4.0 - uTime * 0.3)) * 0.5 + 0.5;
          float horizonMask = exp(-abs(y) * 3.8);
          col += uAccentColor * horizonMask * (0.14 + uBass * 0.32 + uMid * 0.2) * band1;

          float zenithWave = sin(length(dir.xz) * 9.0 - uTime * 1.1) * 0.5 + 0.5;
          col += uAccentColor * max(0.0, y) * zenithWave * (0.05 + uTreble * 0.22);

          vec3 warmShift = vec3(0.22, 0.05, -0.08) * (uWarmth - 0.5);
          gl_FragColor = vec4(clamp(col + warmShift, 0.0, 1.0), 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
  }

  _initKineticText3DSystem() {
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1536;
    this.textCanvas.height = 384;
    this.textCtx = this.textCanvas.getContext('2d');

    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;
    this.textTexture.magFilter = THREE.LinearFilter;

    this.text3DGroup = new THREE.Group();
    this.text3DGroup.visible = false;
    this.text3DGroup.renderOrder = 999;
    this.textLayers = [];
    this.textWidthMultiplier = 1.0;

    const layerCount = 8;
    const planeGeo = new THREE.PlaneGeometry(32, 8.0, 16, 4);

    for (let i = 0; i < layerCount; i++) {
      const isFront = i === layerCount - 1;
      const isBack = i === 0;
      const t = i / (layerCount - 1);
      const layerColor = isFront
        ? new THREE.Color(0xffffff)
        : new THREE.Color(this.text3DColor || '#ff0055').multiplyScalar(0.18 + t * 0.35);

      const mat = new THREE.MeshBasicMaterial({
        map: this.textTexture,
        color: layerColor,
        transparent: true,
        opacity: isFront ? 1.0 : (isBack ? 0.55 : 0.35 + t * 0.45),
        depthTest: false,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide
      });

      const layerMesh = new THREE.Mesh(planeGeo, mat);
      layerMesh.renderOrder = 999;
      layerMesh.frustumCulled = false;
      layerMesh.position.z = (i - (layerCount - 1) * 0.5) * 0.35;
      this.text3DGroup.add(layerMesh);
      this.textLayers.push(layerMesh);
    }
  }

  updateTextCanvas(text = '', mode = 'extrude') {
    const clean = String(text || '').slice(0, 72);
    this.kineticText = clean;
    this.kineticTextMode = mode || 'extrude';

    if (!this.text3DGroup || !this.textCtx) return;

    if (!clean.trim()) {
      this.text3DGroup.visible = false;
      return;
    }

    this.text3DGroup.visible = true;
    const ctx = this.textCtx;
    const w = this.textCanvas.width;
    const h = this.textCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const upper = clean.trim().toUpperCase();
    let lines = [upper];
    const fontFam = this.text3DFont || 'Impact';
    const userSize = Number(this.text3DSize) || 60;
    const sizeScale = userSize / 60.0;
    let fontSize = Math.round(152 * sizeScale);
    this.textWidthMultiplier = 1.0;

    if (upper.length > 12) {
      // Split long phrases into 2 centered lines at nearest space to midpoint when available
      const mid = Math.floor(upper.length / 2);
      let splitIdx = -1;
      let bestDist = 999;
      for (let i = 0; i < upper.length; i++) {
        if (upper[i] === ' ') {
          const d = Math.abs(i - mid);
          if (d < bestDist) {
            bestDist = d;
            splitIdx = i;
          }
        }
      }
      if (splitIdx > 2 && splitIdx < upper.length - 2) {
        lines = [upper.slice(0, splitIdx).trim(), upper.slice(splitIdx + 1).trim()];
        const longest = Math.max(lines[0].length, lines[1].length);
        fontSize = Math.round((longest > 20 ? 74 : (longest > 14 ? 94 : 112)) * sizeScale);
        this.textWidthMultiplier = longest > 18 ? 1.32 : 1.18;
      } else {
        fontSize = Math.round((upper.length > 26 ? 68 : (upper.length > 18 ? 88 : 112)) * sizeScale);
        this.textWidthMultiplier = upper.length > 18 ? 1.35 : 1.18;
      }
    }

    ctx.font = `900 ${fontSize}px "${fontFam}", "JetBrains Mono", sans-serif`;
    // Auto-fit horizontal width inside canvas with safe margin so nothing clips
    const maxAllowedW = w * 0.92;
    let measuredMax = 0;
    for (let i = 0; i < lines.length; i++) {
      measuredMax = Math.max(measuredMax, ctx.measureText(lines[i]).width);
    }
    if (measuredMax > maxAllowedW && measuredMax > 0) {
      fontSize = Math.max(16, Math.floor(fontSize * (maxAllowedW / measuredMax)));
      ctx.font = `900 ${fontSize}px "${fontFam}", "JetBrains Mono", sans-serif`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lineGap = fontSize * 1.14;
    const startY = lines.length === 2 ? h * 0.5 - lineGap * 0.5 : h * 0.5;

    const style = this.text3DBorderStyle || 'neon';
    const chosenColor = this.text3DColor || '#ff0055';
    let fillStyle = chosenColor;
    if (style === 'gold') {
      const goldGrad = ctx.createLinearGradient(0, h * 0.18, 0, h * 0.82);
      goldGrad.addColorStop(0, '#fef08a');
      goldGrad.addColorStop(0.5, '#f59e0b');
      goldGrad.addColorStop(1, '#b45309');
      fillStyle = goldGrad;
    } else if (style === 'cyan') {
      const cyanGrad = ctx.createLinearGradient(0, h * 0.18, 0, h * 0.82);
      cyanGrad.addColorStop(0, '#67e8f9');
      cyanGrad.addColorStop(0.5, '#00f0ff');
      cyanGrad.addColorStop(1, '#0284c7');
      fillStyle = cyanGrad;
    }

    for (let li = 0; li < lines.length; li++) {
      const ly = startY + li * lineGap;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.shadowBlur = 0;
      ctx.lineWidth = style === 'solid'
        ? Math.max(8, Math.round(fontSize * 0.11))
        : Math.max(6, Math.round(fontSize * 0.08));
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(lines[li], w * 0.5, ly);
      ctx.restore();

      ctx.save();
      if (style === 'neon') {
        ctx.shadowColor = chosenColor;
        ctx.shadowBlur = Math.min(10, Math.max(4, Math.round(fontSize * 0.07)));
      } else if (style === 'gold') {
        ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
        ctx.shadowBlur = 6;
      } else if (style === 'cyan') {
        ctx.shadowColor = 'rgba(0, 240, 255, 0.45)';
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(lines[li], w * 0.5, ly);
      ctx.restore();
    }

    this.textTexture.needsUpdate = true;
  }

  setTextStyle(fontFamily, fontSize, color, borderStyle) {
    if (fontFamily) this.text3DFont = String(fontFamily);
    if (fontSize !== undefined && fontSize !== null) this.text3DSize = Number(fontSize) || 60;
    if (color) this.text3DColor = String(color);
    if (borderStyle) this.text3DBorderStyle = String(borderStyle);
    this.updateTextCanvas(this.kineticText, this.kineticTextMode);
  }

  setMorphAngle(val) {
    this.morphAngle = Number(val) || 0;
  }

  setText3D(text = '', mode = 'extrude') {
    this.updateTextCanvas(text, mode);
  }

  _updateKineticText3D(audio, bpmPhase) {
    if (!this.text3DGroup || !this.text3DGroup.visible || !this.kineticText.trim()) return;

    // Keep text squarely in foreground ahead of camera (never occluded due to depthTest:false + renderOrder:999)
    this.camera.getWorldDirection(this._vecA);
    this.text3DGroup.position.copy(this.camera.position).addScaledVector(this._vecA, 32);
    this.text3DGroup.position.y += Math.sin(this.time * 2.1) * 0.65;
    this.text3DGroup.quaternion.copy(this.camera.quaternion);

    // Mid tilts & waves the 3D text block
    const tiltX = Math.sin(this.time * 3.0 + bpmPhase * Math.PI * 2) * (0.06 + audio.mid * 0.24);
    const tiltY = Math.cos(this.time * 2.2) * (0.10 + audio.mid * 0.28);
    this.text3DGroup.rotateX(tiltX);
    this.text3DGroup.rotateY(tiltY);

    // Bass pushes and extrudes the 8 depth planes toward the camera
    const zSpacing = 0.26 + audio.bass * 1.45;
    const baseScale = 1.0 + audio.bass * 0.25;
    const widthMul = this.textWidthMultiplier || 1.0;
    const layerCount = this.textLayers.length;

    for (let i = 0; i < layerCount; i++) {
      const layer = this.textLayers[i];
      const centered = i - (layerCount - 1) * 0.5;
      layer.position.z = centered * zSpacing;

      // Treble splits the edges with neon/glitch offset, Mid adds wave undulation
      const glitchSplit = audio.treble > 0.18
        ? Math.sin(this.time * 28.0 + i * 2.1) * audio.treble * 1.35 * (1.0 - i / layerCount)
        : 0;
      layer.position.x = glitchSplit + Math.sin(this.time * 4.2 + i * 0.55) * audio.mid * 0.55;
      layer.position.y = Math.cos(this.time * 3.6 + i * 0.45) * audio.mid * 0.4;
      layer.rotation.z = Math.sin(this.time * 2.8 + i * 0.35) * audio.mid * 0.06;

      const s = baseScale * (0.92 + (i / layerCount) * 0.12);
      layer.scale.set(s * widthMul, s, 1);

      if (i === layerCount - 1) {
        layer.material.color.setHex(0xffffff);
      } else {
        const baseTint = this.text3DBorderStyle === 'gold'
          ? '#f59e0b'
          : (this.text3DBorderStyle === 'cyan' ? '#00f0ff' : (this.text3DColor || '#ff0055'));
        layer.material.color.set(baseTint).multiplyScalar(0.16 + (i / layerCount) * 0.34);
      }
    }
  }

  // ============================================================================
  // 3D WEATHER PARTICLE SYSTEM & LIGHTNING STORM (Tormenta, Calor Solar, Nieve)
  // ============================================================================
  _initWeatherSystem() {
    this.weatherGroup = new THREE.Group();
    this.weatherGroup.visible = false;
    this.weatherRainGroup = this.weatherGroup;
    this.weatherParticleCount = 1100;
    this.weatherMode = 'none'; // 'none' | 'storm' | 'heat' | 'snow'
    this.weatherLightning = 0;
    this.lastLightningTime = -10;

    const positions = new Float32Array(this.weatherParticleCount * 3);
    const velocities = new Float32Array(this.weatherParticleCount * 3);
    for (let i = 0; i < this.weatherParticleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 140;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
      velocities[i * 3] = (Math.random() - 0.5) * 2.0;
      velocities[i * 3 + 1] = -(15 + Math.random() * 25);
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 2.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.5,
      map: this.glowTexture,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.weatherPoints = new THREE.Points(geo, mat);
    this.weatherPoints.frustumCulled = false;
    this.weatherVelocities = velocities;
    this.weatherGroup.add(this.weatherPoints);

    // Lightning directional flash light
    this.weatherFlashLight = new THREE.PointLight(0x7dd3fc, 0, 260);
    this.weatherFlashLight.position.set(0, 48, -20);
    this.weatherGroup.add(this.weatherFlashLight);

    // 3D Volumetric Clouds Rig (Layer of high puffy clouds drifting with wind)
    this.cloudsGroup = new THREE.Group();
    this.cloudsGroup.visible = false;
    this.cloudMeshes = [];
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });

    for (let c = 0; c < 16; c++) {
      const cloud = new THREE.Group();
      const puffCount = 5;
      for (let p = 0; p < puffCount; p++) {
        const r = 5.5 + Math.random() * 4.0;
        const puffGeo = new THREE.SphereGeometry(r, 7, 6);
        puffGeo.scale(1.8, 0.65, 1.2);
        const puff = new THREE.Mesh(puffGeo, this.cloudMat);
        puff.position.set((p - 2) * 5.2, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 3.6);
        cloud.add(puff);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 260,
        38 + Math.random() * 22,
        (Math.random() - 0.5) * 260
      );
      this.cloudsGroup.add(cloud);
      this.cloudMeshes.push(cloud);
    }
  }

  applyWeather(weatherData) {
    if (!weatherData) {
      this.weatherMod.active = false;
      this.weatherMode = 'none';
      if (this.weatherGroup) this.weatherGroup.visible = false;
      if (this.weatherRainGroup) this.weatherRainGroup.visible = false;
      if (this.weatherPoints) {
        this.weatherPoints.visible = false;
        if (this.weatherPoints.material) this.weatherPoints.material.opacity = 0.0;
      }
      if (this.cloudsGroup) this.cloudsGroup.visible = false;
      return;
    }

    const temp = Number(weatherData.temp);
    const wind = Number(weatherData.wind) || 12;
    const cond = String(weatherData.condition || '').toLowerCase();
    const weatherMain = String(weatherData.weatherMain || (weatherData.weather && weatherData.weather[0] && weatherData.weather[0].main) || '').toLowerCase();
    const explicitMode = String(weatherData.mode || '').toLowerCase();
    const rawCond = `${cond} ${weatherMain} ${explicitMode}`.toLowerCase();
    const hasDryOrCloudyKeyword = /(clear|cloud|overcast|mist|fog|despej|nub|niebl|bruma|cubierto)/i.test(rawCond);
    const hasRainOrThunderKeyword = /(rain|drizzle|thunder|torment|lluv|chubasc|aguacer)/i.test(rawCond);
    const forceNoRain = hasDryOrCloudyKeyword && !hasRainOrThunderKeyword;

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
    } else if (!forceNoRain && (weatherMain === 'snow' || /niev|snow|hielo/i.test(cond) || (Number.isFinite(temp) && temp <= 2))) {
      mode = 'snow';
    } else {
      mode = (Number.isFinite(temp) && temp >= 24) ? 'clear' : 'clouds';
    }

    if (forceNoRain && mode === 'snow' && !/(snow|niev|hielo)/i.test(rawCond)) {
      mode = /fog|mist|niebl|bruma/i.test(rawCond) ? 'fog' : (/cloud|overcast|nub|cubierto/i.test(rawCond) ? 'clouds' : 'clear');
    }

    this.weatherMode = mode;
    this.weatherMod.active = true;
    this.weatherMod.temp = Number.isFinite(temp) ? temp : 22;
    this.weatherMod.wind = wind;

    // Day/Night determination from data or local time
    let isDay;
    if (typeof weatherData.isDay === 'boolean') {
      isDay = weatherData.isDay;
    } else if (weatherData.is_day !== undefined) {
      isDay = Boolean(Number(weatherData.is_day));
    } else if (/noche|night|oscur/i.test(cond)) {
      isDay = false;
    } else if (/sol|day|dia|clear|despej/i.test(cond)) {
      isDay = true;
    } else {
      const hr = new Date().getHours();
      isDay = (hr >= 6 && hr < 19);
    }
    this.isDay = isDay;

    // Configuración atmosférica precisa por condición meteorológica
    if (mode === 'thunderstorm') {
      // Thunderstorm: Lluvia intensa + relámpagos al ritmo del Bass
      this.weatherMod.warmth = 0.05;
      this.weatherMod.fogMultiplier = 1.75;
      if (this.weatherGroup) this.weatherGroup.visible = true;
      if (this.weatherPoints) {
        this.weatherPoints.visible = true;
        this.weatherPoints.material.color.setHex(0x38bdf8);
        this.weatherPoints.material.size = 1.6;
        this.weatherPoints.material.opacity = 0.95;
      }
      if (this.cloudsGroup) {
        this.cloudsGroup.visible = true;
        if (this.cloudMat) {
          this.cloudMat.color.setHex(0x334155);
          this.cloudMat.opacity = 0.75;
        }
      }
    } else if (mode === 'rain') {
      // Rain / Drizzle: Solo aquí activa gotas de lluvia diagonales y charcos reflectantes (0% rayos)
      this.weatherMod.warmth = 0.12;
      this.weatherMod.fogMultiplier = 1.35;
      if (this.weatherGroup) this.weatherGroup.visible = true;
      if (this.weatherPoints) {
        this.weatherPoints.visible = true;
        this.weatherPoints.material.color.setHex(0x7dd3fc);
        this.weatherPoints.material.size = 1.4;
        this.weatherPoints.material.opacity = 0.88;
      }
      if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      if (this.cloudsGroup) {
        this.cloudsGroup.visible = true;
        if (this.cloudMat) {
          this.cloudMat.color.setHex(0x64748b);
          this.cloudMat.opacity = 0.58;
        }
      }
    } else if (mode === 'clouds') {
      // Clouds: Capas de nubes volumétricas 3D desplazándose por lo alto, luz difusa suave y 0% gotas de lluvia
      this.weatherMod.warmth = 0.45;
      this.weatherMod.fogMultiplier = 1.05;
      if (this.weatherGroup) this.weatherGroup.visible = false;
      if (this.weatherRainGroup) this.weatherRainGroup.visible = false;
      if (this.weatherPoints) {
        this.weatherPoints.visible = false;
        if (this.weatherPoints.material) this.weatherPoints.material.opacity = 0.0;
      }
      if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      if (this.cloudsGroup) {
        this.cloudsGroup.visible = true;
        if (this.cloudMat) {
          this.cloudMat.color.setHex(0xe2e8f0);
          this.cloudMat.opacity = 0.45;
        }
      }
    } else if (mode === 'fog') {
      // Mist / Fog / Haze: Incrementa la niebla atmosférica (FogExp2), 0% gotas de lluvia
      this.weatherMod.warmth = 0.25;
      this.weatherMod.fogMultiplier = 2.65;
      if (this.weatherGroup) this.weatherGroup.visible = false;
      if (this.weatherRainGroup) this.weatherRainGroup.visible = false;
      if (this.weatherPoints) {
        this.weatherPoints.visible = false;
        if (this.weatherPoints.material) this.weatherPoints.material.opacity = 0.0;
      }
      if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      if (this.cloudsGroup) this.cloudsGroup.visible = false;
    } else if (mode === 'snow') {
      // Nieve Polar
      this.weatherMod.warmth = 0.02;
      this.weatherMod.fogMultiplier = 2.05;
      if (this.weatherGroup) this.weatherGroup.visible = true;
      if (this.weatherPoints) {
        this.weatherPoints.visible = true;
        this.weatherPoints.material.color.setHex(0xe0f2fe);
        this.weatherPoints.material.size = 2.2;
        this.weatherPoints.material.opacity = 0.9;
      }
      if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      if (this.cloudsGroup) this.cloudsGroup.visible = false;
    } else {
      // Clear (Despejado): Cielo limpio, sol o luna nítidos, 0% lluvia, neblina mínima
      this.weatherMod.warmth = 0.95;
      this.weatherMod.fogMultiplier = 0.55;
      if (this.weatherGroup) this.weatherGroup.visible = false;
      if (this.weatherRainGroup) this.weatherRainGroup.visible = false;
      if (this.weatherPoints) {
        this.weatherPoints.visible = false;
        if (this.weatherPoints.material) this.weatherPoints.material.opacity = 0.0;
      }
      if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      if (this.cloudsGroup) this.cloudsGroup.visible = false;
    }

    if (forceNoRain) {
      if (this.weatherGroup) this.weatherGroup.visible = false;
      if (this.weatherRainGroup) this.weatherRainGroup.visible = false;
      if (this.weatherPoints) {
        this.weatherPoints.visible = false;
        if (this.weatherPoints.material) this.weatherPoints.material.opacity = 0.0;
      }
    }
  }

  setWeatherModulation(weatherData) {
    this.applyWeather(weatherData);
  }

  _updateWeatherSystem(w, dt, audio) {
    // 1. Desplazamiento horizontal de nubes volumétricas 3D según el viento
    if (this.cloudsGroup && this.cloudsGroup.visible && this.cloudMeshes) {
      this.cloudsGroup.position.x = this.camera.position.x;
      this.cloudsGroup.position.z = this.camera.position.z;
      const windFactor = 0.5 + (this.weatherMod.wind || 12) * 0.06;
      const driftSpeed = (6.0 + windFactor * 5.0) * dt;
      for (let i = 0; i < this.cloudMeshes.length; i++) {
        const cl = this.cloudMeshes[i];
        cl.position.x += driftSpeed;
        if (cl.position.x > 140) cl.position.x -= 280;
      }
    }

    if (!this.weatherGroup || !this.weatherGroup.visible || !this.weatherPoints || !this.weatherPoints.visible) return;

    // Keep particle volume centered around camera so it works in any world at any position
    this.weatherGroup.position.copy(this.camera.position);

    const posAttr = this.weatherPoints.geometry.attributes.position;
    const arr = posAttr.array;
    const vel = this.weatherVelocities;
    const windFactor = 0.5 + (this.weatherMod.wind || 12) * 0.06;

    if (this.weatherMode === 'thunderstorm' || this.weatherMode === 'rain') {
      // Relámpagos ÚNICAMENTE en tormenta, sincronizados con el Bass
      if (this.weatherMode === 'thunderstorm') {
        if (audio.rawBass > 0.42 && (this.time - this.lastLightningTime) > 0.45) {
          this.lastLightningTime = this.time;
          this.weatherLightning = 1.0;
        } else {
          this.weatherLightning = Math.max(0, this.weatherLightning - dt * 4.2);
        }

        if (this.weatherFlashLight) {
          this.weatherFlashLight.intensity = this.weatherLightning * 7.5;
          this.weatherFlashLight.color.setHex(this.weatherLightning > 0.5 ? 0xe0f2fe : 0x38bdf8);
        }
        if (w.scene && w.scene.fog) {
          this._colorA.setHex(0x04182e).lerp(this._colorB.setHex(0x7dd3fc), this.weatherLightning * 0.55);
          w.scene.fog.color.copy(this._colorA);
        }
      } else {
        this.weatherLightning = 0;
        if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      }

      // Gotas de lluvia diagonales 3D
      const rainSpeedY = -(52 + windFactor * 16 + audio.bass * 28);
      const rainDriftX = -(16 + windFactor * 14);
      for (let i = 0; i < this.weatherParticleCount; i++) {
        const idx = i * 3;
        arr[idx] += rainDriftX * dt;
        arr[idx + 1] += rainSpeedY * dt;
        if (arr[idx + 1] < -45) arr[idx + 1] += 90;
        if (arr[idx] < -70) arr[idx] += 140;
      }
    } else if (this.weatherMode === 'snow') {
      this.weatherLightning = 0;
      if (this.weatherFlashLight) this.weatherFlashLight.intensity = 0;
      if (w.scene && w.scene.fog) {
        w.scene.fog.color.setHex(0x0f2740);
      }

      const fallY = -(9 + windFactor * 2.5);
      for (let i = 0; i < this.weatherParticleCount; i++) {
        const idx = i * 3;
        arr[idx] += (Math.sin(this.time * 1.4 + i) * 4.5 + windFactor * 3.0) * dt;
        arr[idx + 1] += fallY * dt;
        arr[idx + 2] += Math.cos(this.time * 1.1 + i * 0.5) * 3.5 * dt;
        if (arr[idx + 1] < -45) arr[idx + 1] += 90;
        if (arr[idx] > 70) arr[idx] -= 140;
      }
    }

    posAttr.needsUpdate = true;
  }

  // ============================================================================
  // CONTROLS & CAMERA SYSTEM
  // ============================================================================
  _isTypingTarget(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  _isHudElement(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(
      target.closest(
        '.workstation-panel, .rack-module, .hud-header, .td-inspector-bar, .td-modal-backdrop, button, input, select, details'
      )
    );
  }

  _bindControls() {
    window.addEventListener('keydown', (e) => {
      if (!this.active || this._isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'r') {
        this.resetCamera(true);
        return;
      }
      if (k === ' ' || e.code === 'Space') {
        if (this.worldIndex === 1) {
          this.cycleBiome(true);
          if (typeof this.spawnRoadObject === 'function') this.spawnRoadObject(true);
        } else if (this.worldIndex === 0) {
          this.triggerBioPulse(1.0);
        }
        return;
      }
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys[k] = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
    });

    window.addEventListener('pointerdown', (e) => {
      if (!this.active || this._isHudElement(e.target)) return;
      this.pointer.dragging = true;
      this.pointer.lastX = e.clientX;
      this.pointer.lastY = e.clientY;
      this.pointer.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      this.pointer.y = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;

      // In Bio-Aquarium 3D, clicking the water spawns a Bioluminescent Food Orb at the pointer!
      if (this.worldIndex === 0 && this.worlds[0]) {
        this._spawnAquariumOrb(this.worlds[0], true);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      this.pointer.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      this.pointer.y = -(e.clientY / Math.max(1, window.innerHeight)) * 2 + 1;

      if (this.pointer.dragging) {
        const dx = e.clientX - this.pointer.lastX;
        const dy = e.clientY - this.pointer.lastY;
        this.pointer.lastX = e.clientX;
        this.pointer.lastY = e.clientY;
        this.userCamTarget.orbitX -= dx * 0.0055;
        this.userCamTarget.y = Math.max(-35, Math.min(40, this.userCamTarget.y + dy * 0.14));
      }
    });

    window.addEventListener('pointerup', () => {
      this.pointer.dragging = false;
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.active || this._isHudElement(e.target)) return;
        this.userCamTarget.zOffset = Math.max(-65, Math.min(75, this.userCamTarget.zOffset + e.deltaY * 0.04));
      },
      { passive: true }
    );
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) {
      this.keys = Object.create(null);
      this.pointer.dragging = false;
    }
  }

  pause() {
    this.setActive(false);
  }

  setAutoFlight(enabled) {
    this.autoFlight = Boolean(enabled);
  }

  setWorld(indexOrKey) {
    let idx = 0;
    if (typeof indexOrKey === 'string') {
      const found = this.worldKeys.indexOf(indexOrKey.toLowerCase());
      idx = found >= 0 ? found : (parseInt(indexOrKey, 10) || 0);
    } else {
      idx = parseInt(indexOrKey, 10) || 0;
    }
    const next = Math.max(0, Math.min(3, idx));
    if (next !== this.worldIndex) {
      this.worldIndex = next;
      const targetWorld = this.worlds[this.worldIndex];
      if (targetWorld) {
        if (this.text3DGroup) targetWorld.scene.add(this.text3DGroup);
        if (this.weatherGroup) targetWorld.scene.add(this.weatherGroup);
        if (this.cloudsGroup) targetWorld.scene.add(this.cloudsGroup);
      }
      this.resetCamera(false);
    }
  }

  resetCamera(notify = true) {
    this.userCamTarget.orbitX = 0;
    this.userCamTarget.y = 0;
    this.userCamTarget.zOffset = 0;
    this.userCamCurrent.orbitX = 0;
    this.userCamCurrent.y = 0;
    this.userCamCurrent.zOffset = 0;
    this.flightPhase = 0;
    if (notify && typeof this.onCameraReset === 'function') {
      this.onCameraReset();
    }
  }

  setCameraOrbitNormalized(norm01) {
    const v = Math.max(0, Math.min(1, Number(norm01) || 0));
    this.userCamTarget.orbitX = (v - 0.5) * Math.PI * 2;
  }

  setCameraZoomNormalized(norm01) {
    const v = Math.max(0, Math.min(1, Number(norm01) || 0));
    this.userCamTarget.zOffset = (0.5 - v) * 90;
  }

  setBioInput(val, delta) {
    this.bioValue = Math.max(0.0, Math.min(1.0, Number(val) || 0));
    this.bioDelta = Number(delta) || 0;
  }

  triggerBioPulse(bioPulse = 1.0) {
    const pulseVal = Math.max(0.0, Math.min(1.0, Number(bioPulse) || 1.0));
    this.bioValue = pulseVal;
    const w = this.worlds && this.worlds[this.worldIndex];
    if (!w) return;

    if (this.worldIndex === 0) {
      // 0: Ocean Diver 3D -> Bio-acoustic sonar wave + megafauna excitation
      this._spawnAquariumOrb(w, false);
      if (w.whales) {
        w.whales.forEach(wh => { wh.sonarProgress = 0.0; });
      }
    } else if (this.worldIndex === 1) {
      // 1: Endless Drive 3D -> Cambiar bioma visiblemente y spawnear objeto lateral
      this.cycleBiome(true);
      if (typeof this.spawnRoadObject === 'function') {
        this.spawnRoadObject(true);
      } else if (typeof this._activateRoadSlot === 'function') {
        this._activateRoadSlot(w);
      }
    } else if (this.worldIndex === 2) {
      // 2: Bio-Terra 3D -> Surge waterfall particles and excite light creatures
      if (w.wfVels) {
        for (let i = 0; i < w.wfVels.length; i++) {
          const v = w.wfVels[i];
          if (v && typeof v === 'object') {
            v.vy = -Math.max(12, (Math.random() * 14 + 12) * (1 + pulseVal * 0.5));
          }
        }
      }
      if (w.creatures) {
        w.creatures.forEach(cr => {
          cr.speed = 2.8 + Math.random() * 3.5 * pulseVal;
        });
      }
    } else if (this.worldIndex === 3) {
      // 3: Catedral LiDAR -> Monolith disassembly pulse
      this.time += pulseVal * 0.6;
    }
  }

  cycleBiome(manual = false) {
    const w = this.worlds && this.worlds[1];
    if (w && typeof w.cycleBiome === 'function') {
      return w.cycleBiome(manual);
    }
    return null;
  }

  _updateCamera(dt, speedParam, audioEnergy) {
    const moveSpeed = 28 * dt;
    if (this.keys['a'] || this.keys['arrowleft']) this.userCamTarget.orbitX -= 1.35 * dt;
    if (this.keys['d'] || this.keys['arrowright']) this.userCamTarget.orbitX += 1.35 * dt;
    if (this.keys['w'] || this.keys['arrowup']) {
      this.userCamTarget.zOffset = Math.max(-65, this.userCamTarget.zOffset - moveSpeed);
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      this.userCamTarget.zOffset = Math.min(75, this.userCamTarget.zOffset + moveSpeed);
    }
    if (this.keys['q']) this.userCamTarget.y = Math.max(-35, this.userCamTarget.y - moveSpeed * 0.7);
    if (this.keys['e']) this.userCamTarget.y = Math.min(40, this.userCamTarget.y + moveSpeed * 0.7);

    const damp = Math.min(1, dt * 6.0);
    this.userCamCurrent.orbitX += (this.userCamTarget.orbitX - this.userCamCurrent.orbitX) * damp;
    this.userCamCurrent.y += (this.userCamTarget.y - this.userCamCurrent.y) * damp;
    this.userCamCurrent.zOffset += (this.userCamTarget.zOffset - this.userCamCurrent.zOffset) * damp;

    if (this.autoFlight) {
      this.flightPhase += dt * (0.22 + speedParam * 0.45 + audioEnergy * 0.25);
    }
    const p = this.flightPhase;
    const uOrb = this.userCamCurrent.orbitX;
    const uY = this.userCamCurrent.y;
    const uZ = this.userCamCurrent.zOffset;

    if (this.worldIndex === 0) {
      // 0: Bio-Aquarium 3D — serene underwater glide
      const r = Math.max(22, 54 + uZ * 0.55);
      const ang = (this.autoFlight ? Math.sin(p * 0.45) * 0.55 : 0) + uOrb;
      this.camera.position.set(
        Math.sin(ang) * r,
        4 + (this.autoFlight ? Math.sin(p * 0.65) * 5 : 0) + uY * 0.55,
        Math.cos(ang) * r
      );
      this._finalLook.set(
        Math.sin(p * 0.35) * 8 + this.pointer.x * 10,
        1 + this.pointer.y * 6,
        -12
      );
      this.camera.lookAt(this._finalLook);
    } else if (this.worldIndex === 1) {
      // 1: Endless Night Drive 3D — First-person driver POV inside the night car cabin
      const keySteer = (this.keys['a'] || this.keys['arrowleft'] ? -1 : 0) +
        (this.keys['d'] || this.keys['arrowright'] ? 1 : 0);
      const targetSteer = Math.max(-1, Math.min(1, keySteer * 0.85 + this.pointer.x * 0.75));
      this.steerInput += (targetSteer - this.steerInput) * Math.min(1, dt * 7.5);

      const laneCruise = (this.autoFlight ? Math.sin(p * 0.55) * 2.1 : 0) + this.steerInput * 3.8;
      const roadBounce = Math.sin(this.time * 11.5) * 0.035 + audioEnergy * 0.06;
      const clampedY = Math.max(-0.3, Math.min(0.6, uY * 0.015));

      this.camera.position.set(laneCruise, 2.55 + roadBounce + clampedY, 12.0);
      this._finalLook.set(
        laneCruise + this.steerInput * 5.2 + this.pointer.x * 4.5,
        2.15 + this.pointer.y * 2.2,
        -48
      );
      this.camera.lookAt(this._finalLook);
    } else if (this.worldIndex === 2) {
      // 2: 🌿 Bio-Terra 3D — Planetary flight through floating islands & waterfalls
      const r = Math.max(24, 44 + uZ * 0.45);
      const ang = (this.autoFlight ? p * 0.35 : 0) + uOrb;
      this.camera.position.set(
        Math.sin(ang) * r,
        6 + (this.autoFlight ? Math.sin(p * 0.55) * 4.5 : 0) + uY * 0.45,
        Math.cos(ang) * r
      );
      this._finalLook.set(this.pointer.x * 4, 1.5 + this.pointer.y * 3, 0);
      this.camera.lookAt(this._finalLook);
    } else {
      // 3: 🏛️ Catedral / LiDAR 3D — Mutating architectural fly-through
      const r = Math.max(18, 56 + uZ * 0.55);
      const ang = (this.autoFlight ? Math.sin(p * 0.42) * 0.48 : 0) + uOrb;
      this.camera.position.set(
        Math.sin(ang) * r,
        12.5 + (this.autoFlight ? Math.cos(p * 0.52) * 4.5 : 0) + uY * 0.5,
        Math.cos(ang) * r - 6
      );
      this._finalLook.set(
        this.pointer.x * 10,
        10.5 + this.pointer.y * 7,
        -18
      );
      this.camera.lookAt(this._finalLook);
    }
  }

  _updateWorldAtmosphere(w, audio, dt) {
    if (w.skyDome && w.skyDome.material && w.skyDome.material.uniforms) {
      const u = w.skyDome.material.uniforms;
      u.uTime.value = this.time;
      u.uBass.value = audio.bass;
      u.uMid.value = audio.mid;
      u.uTreble.value = audio.treble;
      u.uWarmth.value = this.weatherMod.active ? this.weatherMod.warmth : 0.5;
      w.skyDome.position.copy(this.camera.position);
    }
    if (w.scene && w.scene.fog && w.baseFogDensity) {
      const weatherMul = this.weatherMod.active ? this.weatherMod.fogMultiplier : 1.0;
      w.scene.fog.density = w.baseFogDensity * weatherMul * (1.0 - audio.bass * 0.12);
    }
  }

  // ============================================================================
  // WORLD 0: 🐟 BIO-AQUARIUM 3D (Ecosistema Interactivo Infinito)
  // - FogExp2, volumetric caustic shafts, infinite moving seabed
  // - Bioluminescent Attractor Orbs spawned on bass > 0.45 or click
  // - 300 Schooling Fish (InstancedMesh) seek nearest orb, circle & consume it -> expanding light ring
  // - 15 Manta Rays undulating wings with mid
  // - 35 Pulsing Jellyfish actively steering to avoid Manta Rays
  // ============================================================================
  _createFishGeometry() {
    const geo = new THREE.ConeGeometry(0.38, 1.95, 6);
    geo.rotateX(Math.PI / 2);
    geo.scale(0.62, 1.0, 1.0);
    return geo;
  }

  _createJellyfishGeometry() {
    const geo = new THREE.SphereGeometry(1.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 0.15) {
        const ang = Math.atan2(pos.getZ(i), pos.getX(i));
        const scallop = 1.0 + Math.sin(ang * 8) * 0.14;
        pos.setX(i, pos.getX(i) * scallop);
        pos.setZ(i, pos.getZ(i) * scallop);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  _createJellyfishTentaclesGeometry() {
    // 6 curved trailing tentacles merged into one lightweight BufferGeometry
    const segs = 6;
    const tentCount = 6;
    const positions = [];
    const indices = [];
    let vertOffset = 0;
    for (let t = 0; t < tentCount; t++) {
      const ang = (t / tentCount) * Math.PI * 2;
      const rx = Math.cos(ang) * 0.55;
      const rz = Math.sin(ang) * 0.55;
      for (let s = 0; s <= segs; s++) {
        const frac = s / segs;
        const y = 0.05 - frac * 3.4;
        const waveX = rx + Math.sin(frac * Math.PI * 2 + t) * 0.18;
        const waveZ = rz + Math.cos(frac * Math.PI * 2 + t) * 0.18;
        const w = 0.06 * (1 - frac * 0.6);
        positions.push(waveX - w, y, waveZ, waveX + w, y, waveZ);
        if (s < segs) {
          const a = vertOffset + s * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, c, b, b, c, d);
        }
      }
      vertOffset += (segs + 1) * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  _createSharkGroup() {
    const g = new THREE.Group();
    const sharkMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.32,
      metalness: 0.52
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.4,
      metalness: 0.25
    });

    // Sleek tapered fusiform body (forward = -Z)
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.92, 4.4, 12);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, sharkMat);
    body.scale.set(0.88, 0.95, 1.0);

    const snoutGeo = new THREE.ConeGeometry(0.92, 2.2, 12);
    snoutGeo.rotateX(-Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeo, sharkMat);
    snout.position.z = -3.3;
    snout.scale.set(0.88, 0.72, 1.0);

    const bellyGeo = new THREE.CylinderGeometry(0.38, 0.80, 4.2, 10, 1, false, Math.PI * 0.5, Math.PI);
    bellyGeo.rotateX(Math.PI / 2);
    bellyGeo.rotateZ(Math.PI);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.set(0, -0.14, -0.2);

    // Prominent triangular dorsal fin
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(1.25, 0);
    dorsalShape.lineTo(0.35, 1.65);
    dorsalShape.closePath();
    const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, { depth: 0.14, bevelEnabled: false });
    dorsalGeo.rotateY(Math.PI / 2);
    const dorsal = new THREE.Mesh(dorsalGeo, sharkMat);
    dorsal.position.set(-0.07, 0.65, -0.5);

    // Lateral pectoral fins
    const pecShape = new THREE.Shape();
    pecShape.moveTo(0, 0);
    pecShape.lineTo(1.6, -0.65);
    pecShape.lineTo(0.65, -1.1);
    pecShape.closePath();
    const pecGeo = new THREE.ExtrudeGeometry(pecShape, { depth: 0.09, bevelEnabled: false });
    pecGeo.rotateX(Math.PI / 2);

    const finL = new THREE.Mesh(pecGeo, sharkMat);
    finL.position.set(-0.55, -0.25, -1.2);
    finL.scale.set(-1, 1, 1);
    const finR = new THREE.Mesh(pecGeo, sharkMat);
    finR.position.set(0.55, -0.25, -1.2);
    g.add(finL, finR);

    // Articulated tail peduncle + vertical crescent caudal fin
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0, 2.1);
    const tailPeduncle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.18, 2.2, 8), sharkMat);
    tailPeduncle.rotation.x = Math.PI / 2;
    tailPeduncle.position.z = 1.1;

    const crescentShape = new THREE.Shape();
    crescentShape.moveTo(0, 0.25);
    crescentShape.lineTo(1.15, 1.75);
    crescentShape.lineTo(0.45, 0.15);
    crescentShape.lineTo(0.45, -0.15);
    crescentShape.lineTo(0.95, -1.35);
    crescentShape.lineTo(0, -0.25);
    crescentShape.closePath();
    const caudalGeo = new THREE.ExtrudeGeometry(crescentShape, { depth: 0.10, bevelEnabled: false });
    caudalGeo.rotateY(-Math.PI / 2);
    const caudalFin = new THREE.Mesh(caudalGeo, sharkMat);
    caudalFin.position.set(0.05, 0, 2.15);

    tailPivot.add(tailPeduncle, caudalFin);
    g.add(body, snout, belly, dorsal, tailPivot);
    g.scale.setScalar(1.15);
    return { group: g, tailPivot, finL, finR };
  }

  _createWhaleGroup() {
    const g = new THREE.Group();
    const whaleMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.42,
      metalness: 0.35
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.55,
      metalness: 0.15
    });
    const grooveMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72
    });

    // Fusiform elongated torso (forward = -Z)
    const torsoGeo = new THREE.CylinderGeometry(2.0, 3.0, 12.5, 14);
    torsoGeo.rotateX(Math.PI / 2);
    const torso = new THREE.Mesh(torsoGeo, whaleMat);
    torso.scale.set(1.12, 0.92, 1.0);

    // Rounded Humpback Head / Rostrum
    const headGeo = new THREE.SphereGeometry(3.0, 14, 12);
    headGeo.scale(1.02, 0.84, 1.75);
    const head = new THREE.Mesh(headGeo, whaleMat);
    head.position.set(0, 0.1, -7.8);

    const jawGeo = new THREE.SphereGeometry(2.6, 12, 10);
    jawGeo.scale(0.96, 0.48, 1.65);
    const jaw = new THREE.Mesh(jawGeo, bellyMat);
    jaw.position.set(0, -1.1, -7.6);

    // Ventral grooves
    for (let gr = -4; gr <= 4; gr++) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, 11.0), grooveMat);
      groove.position.set(gr * 0.48, -2.25 + Math.abs(gr) * 0.16, -4.2);
      g.add(groove);
    }

    // Long articulated humpback pectoral flippers (flattened wing geometry, pivot at shoulder)
    const wingGeo = new THREE.BoxGeometry(8.5, 0.28, 2.2);
    wingGeo.translate(-4.25, 0, 0.4);
    const flipperLPivot = new THREE.Group();
    flipperLPivot.position.set(-2.6, -0.7, -3.5);
    const flipperL = new THREE.Mesh(wingGeo, whaleMat);
    flipperL.rotation.y = -0.35;
    flipperLPivot.add(flipperL);

    const wingGeoR = new THREE.BoxGeometry(8.5, 0.28, 2.2);
    wingGeoR.translate(4.25, 0, 0.4);
    const flipperRPivot = new THREE.Group();
    flipperRPivot.position.set(2.6, -0.7, -3.5);
    const flipperR = new THREE.Mesh(wingGeoR, whaleMat);
    flipperR.rotation.y = 0.35;
    flipperRPivot.add(flipperR);

    // Small humpback dorsal ridge
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.5, 6), whaleMat);
    dorsal.position.set(0, 2.4, 2.6);
    dorsal.rotation.x = -0.45;

    // Articulated rear tail section + horizontal V-shaped caudal fluke
    const flukePivot = new THREE.Group();
    flukePivot.position.set(0, 0, 5.8);
    const peduncle = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 0.78, 7.6, 10), whaleMat);
    peduncle.rotation.x = Math.PI / 2;
    peduncle.position.z = 3.6;

    const flukeShape = new THREE.Shape();
    flukeShape.moveTo(0, 0);
    flukeShape.lineTo(-5.2, 2.4);
    flukeShape.lineTo(-4.4, 0.5);
    flukeShape.lineTo(0, 1.15);
    flukeShape.lineTo(4.4, 0.5);
    flukeShape.lineTo(5.2, 2.4);
    flukeShape.closePath();
    const flukeGeo = new THREE.ExtrudeGeometry(flukeShape, { depth: 0.24, bevelEnabled: false });
    flukeGeo.rotateX(Math.PI / 2);
    const flukeMesh = new THREE.Mesh(flukeGeo, whaleMat);
    flukeMesh.position.set(0, 0.12, 7.1);

    flukePivot.add(peduncle, flukeMesh);
    g.add(torso, head, jaw, flipperLPivot, flipperRPivot, dorsal, flukePivot);

    const sonarRingGeo = new THREE.RingGeometry(2.5, 3.2, 32);
    const sonarRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sonarRing = new THREE.Mesh(sonarRingGeo, sonarRingMat);
    sonarRing.position.set(0, 0, -11);
    g.add(sonarRing);

    g.scale.setScalar(1.05);
    return { group: g, flukePivot, flipperLPivot, flipperRPivot, sonarRing, sonarRingMat };
  }

  _buildAquariumWorld() {
    const scene = new THREE.Scene();
    const baseFogDensity = 0.0068;
    scene.fog = new THREE.FogExp2(0x011a33, baseFogDensity);

    const skyDome = this._createSkyDome({
      top: 0x043a68,
      horizon: 0x02294d,
      bottom: 0x010a18,
      accent: 0x22d3ee
    });
    scene.add(skyDome);

    const hemi = new THREE.HemisphereLight(0x67e8f9, 0x011224, 1.45);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xbae6fd, 1.35);
    sunLight.position.set(25, 95, 18);
    scene.add(sunLight);

    // Luminous Water Surface above at y = +45
    const surfaceGeo = new THREE.PlaneGeometry(420, 420, 28, 28);
    surfaceGeo.rotateX(Math.PI / 2);
    const surfPos = surfaceGeo.attributes.position;
    const surfOrigY = new Float32Array(surfPos.count);
    for (let i = 0; i < surfPos.count; i++) {
      surfOrigY[i] = surfPos.getY(i);
    }
    surfaceGeo.userData = { origY: surfOrigY };
    const surfaceMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const waterSurface = new THREE.Mesh(surfaceGeo, surfaceMat);
    waterSurface.position.y = 45;
    scene.add(waterSurface);

    // Volumetric Caustic Light Shafts descending from surface
    const causticBeams = [];
    const beamGeo = new THREE.CylinderGeometry(3.5, 16, 85, 12, 1, true);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x67e8f9 : 0x38bdf8,
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const beam = new THREE.Mesh(beamGeo, mat);
      const ang = (i / 8) * Math.PI * 2;
      const rad = 28 + (i % 2) * 22;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad - 15;
      beam.position.set(x, 8, z);
      beam.rotation.z = -0.10 + (i % 2) * 0.06;
      scene.add(beam);
      causticBeams.push({ mesh: beam, baseX: x, phase: i * 0.9 });
    }

    // --- 360° OPEN DEEP SEAFLOOR AT y = -35 (Gentle sand dunes + corals, ZERO walls or arches) ---
    const slabLen = 260;
    const makeSeabedSlab = (zPos) => {
      const g = new THREE.Group();
      const seabedGeo = new THREE.PlaneGeometry(380, slabLen, 36, 32);
      seabedGeo.rotateX(-Math.PI / 2);
      const sbPos = seabedGeo.attributes.position;
      for (let i = 0; i < sbPos.count; i++) {
        const x = sbPos.getX(i);
        const z = sbPos.getZ(i);
        const dune = Math.sin(x * 0.055) * 2.4 + Math.cos(z * 0.065) * 1.9 + Math.sin((x + z) * 0.03) * 1.3;
        sbPos.setY(i, dune);
      }
      seabedGeo.computeVertexNormals();

      const seabedMat = new THREE.MeshStandardMaterial({
        color: 0x062d47,
        roughness: 0.88,
        metalness: 0.12
      });
      const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
      seabedMesh.position.y = -35;
      g.add(seabedMesh);

      // Organic coral mounds & kelp gardens scattered across the seafloor (no debris/arches)
      const coralColors = [0xf43f5e, 0x06b6d4, 0xa855f7, 0xf59e0b, 0x10b981];
      for (let c = 0; c < 18; c++) {
        const cx = ((c * 73) % 280) - 140;
        const cz = ((c * 59) % (slabLen - 20)) - (slabLen * 0.5 - 10);
        const duneY = -35 + Math.sin(cx * 0.055) * 2.4 + Math.cos(cz * 0.065) * 1.9;
        const cCol = coralColors[c % coralColors.length];
        if (c % 2 === 0) {
          // Coral cluster (rounded organic domes + branches)
          const coralGroup = new THREE.Group();
          const cMat = new THREE.MeshStandardMaterial({
            color: cCol,
            emissive: cCol,
            emissiveIntensity: 0.25,
            roughness: 0.55
          });
          for (let b = 0; b < 3; b++) {
            const r = 1.1 + (b % 2) * 0.65;
            const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), cMat);
            dome.scale.set(1.0, 0.75 + b * 0.35, 1.0);
            dome.position.set((b - 1) * 1.35, r * 0.5, (b % 2) * 0.9);
            coralGroup.add(dome);
          }
          coralGroup.position.set(cx, duneY, cz);
          g.add(coralGroup);
        } else {
          // Tall kelp stalks
          const kelpMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.7 });
          for (let k = 0; k < 3; k++) {
            const h = 7 + (k % 3) * 3.5;
            const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, h, 5), kelpMat);
            stalk.position.set(cx + (k - 1) * 0.9, duneY + h * 0.5, cz + k * 0.6);
            stalk.rotation.z = (k - 1) * 0.14;
            g.add(stalk);
          }
        }
      }

      g.position.z = zPos;
      return g;
    };

    const seabedA = makeSeabedSlab(0);
    const seabedB = makeSeabedSlab(-slabLen);
    scene.add(seabedA, seabedB);

    // --- RISING BUBBLE STREAMS (280 ascending bubble particles around diver) ---
    const bubbleCount = 280;
    const bubblePositions = new Float32Array(bubbleCount * 3);
    const bubbleVels = new Float32Array(bubbleCount);
    for (let b = 0; b < bubbleCount; b++) {
      bubblePositions[b * 3] = (Math.random() - 0.5) * 110;
      bubblePositions[b * 3 + 1] = -34 + Math.random() * 76;
      bubblePositions[b * 3 + 2] = (Math.random() - 0.5) * 110;
      bubbleVels[b] = 3.5 + Math.random() * 5.0;
    }
    const bubbleGeo = new THREE.BufferGeometry();
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
    const bubbleMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      map: this.glowTexture,
      size: 1.15,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const bubblePoints = new THREE.Points(bubbleGeo, bubbleMat);
    scene.add(bubblePoints);

    // --- VISOR DE BUZO HUD (Curved Corner Mask Frame + Top Compass + Telemetry + Live Sonar) ---
    const diverHudGroup = new THREE.Group();
    scene.add(diverHudGroup);

    const cornerCanvas = document.createElement('canvas');
    cornerCanvas.width = 512;
    cornerCanvas.height = 512;
    const cCtx = cornerCanvas.getContext('2d');
    // Subtle curved scuba mask frame in corners leaving 90%+ center view completely open
    const grad = cCtx.createRadialGradient(256, 256, 175, 256, 256, 325);
    grad.addColorStop(0, 'rgba(1, 14, 28, 0)');
    grad.addColorStop(0.76, 'rgba(1, 18, 36, 0.20)');
    grad.addColorStop(0.90, 'rgba(1, 12, 24, 0.68)');
    grad.addColorStop(1.0, 'rgba(0, 6, 14, 0.92)');
    cCtx.fillStyle = grad;
    cCtx.fillRect(0, 0, 512, 512);
    // Crisp curved corner brackets
    cCtx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    cCtx.lineWidth = 4;
    cCtx.beginPath();
    cCtx.roundRect(14, 14, 484, 484, 72);
    cCtx.stroke();

    const visorOverlayTex = new THREE.CanvasTexture(cornerCanvas);
    const visorOverlayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 1.52),
      new THREE.MeshBasicMaterial({
        map: visorOverlayTex,
        transparent: true,
        depthTest: false,
        depthWrite: false
      })
    );
    visorOverlayPlane.position.set(0, 0, -1.16);
    visorOverlayPlane.renderOrder = 10;
    diverHudGroup.add(visorOverlayPlane);

    // Top Degree Compass (rotates live with CAM ORBIT)
    const compassCanvas = document.createElement('canvas');
    compassCanvas.width = 512;
    compassCanvas.height = 72;
    const compassCtx = compassCanvas.getContext('2d');
    const compassTexture = new THREE.CanvasTexture(compassCanvas);
    const compassPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.12),
      new THREE.MeshBasicMaterial({ map: compassTexture, transparent: true, depthTest: false })
    );
    compassPlane.position.set(0, 0.65, -1.12);
    compassPlane.renderOrder = 11;
    diverHudGroup.add(compassPlane);

    // Circular Mini-Sonar (Lower Left corner — shows live green blips for whales & sharks)
    const sonarGroup = new THREE.Group();
    sonarGroup.position.set(-0.92, -0.54, -1.10);
    const sonarFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.115, 32),
      new THREE.MeshBasicMaterial({ color: 0x021b2d, transparent: true, opacity: 0.85, depthTest: false })
    );
    const sonarBezel = new THREE.Mesh(
      new THREE.RingGeometry(0.112, 0.122, 32),
      new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false })
    );
    const sonarRingMid = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.063, 28),
      new THREE.MeshBasicMaterial({ color: 0x047857, transparent: true, opacity: 0.7, depthTest: false })
    );
    const sonarHandPivot = new THREE.Group();
    const sonarHand = new THREE.Mesh(
      new THREE.PlaneGeometry(0.004, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85, depthTest: false })
    );
    sonarHand.position.y = 0.055;
    sonarHandPivot.add(sonarHand);
    sonarGroup.add(sonarFace, sonarBezel, sonarRingMid, sonarHandPivot);

    // 14 Live Sonar Blips (4 whales + 10 sharks)
    const sonarBlips = [];
    for (let bl = 0; bl < 14; bl++) {
      const isWhale = bl < 4;
      const blip = new THREE.Mesh(
        new THREE.CircleGeometry(isWhale ? 0.009 : 0.006, 10),
        new THREE.MeshBasicMaterial({
          color: isWhale ? 0x4ade80 : 0x22c55e,
          transparent: true,
          opacity: 0.95,
          depthTest: false
        })
      );
      blip.position.set(0, 0, 0.003);
      sonarGroup.add(blip);
      sonarBlips.push(blip);
    }
    diverHudGroup.add(sonarGroup);

    // Telemetry Readout (Lower Right corner: DEPTH, TEMP, O2)
    const depthCanvas = document.createElement('canvas');
    depthCanvas.width = 300;
    depthCanvas.height = 136;
    const depthCtx = depthCanvas.getContext('2d');
    const depthTexture = new THREE.CanvasTexture(depthCanvas);
    const depthPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.19),
      new THREE.MeshBasicMaterial({ map: depthTexture, transparent: true, opacity: 0.96, depthTest: false })
    );
    depthPlane.position.set(0.86, -0.56, -1.10);
    depthPlane.renderOrder = 11;
    diverHudGroup.add(depthPlane);

    // --- MEGAFAUNA MARINA RECONOCIBLE ---
    // 1. 4 Ballenas Jorobadas Majestuosas (con aletas pectorales y aleta caudal en V)
    const whales = [];
    const whaleConfigs = [
      { radius: 42, y: 14, scale: 1.25, phase: 0.2, speed: 0.13 },
      { radius: 64, y: 4, scale: 1.15, phase: 1.8, speed: 0.10 },
      { radius: 52, y: -12, scale: 1.35, phase: 3.4, speed: 0.11 },
      { radius: 78, y: 22, scale: 1.10, phase: 4.9, speed: 0.09 }
    ];
    whaleConfigs.forEach((cfg, idx) => {
      const wh = this._createWhaleGroup();
      wh.group.scale.setScalar(cfg.scale);
      wh.swimPhase = cfg.phase;
      wh.swimRadius = cfg.radius;
      wh.baseY = cfg.y;
      wh.speed = cfg.speed;
      wh.sonarLife = 0;
      wh.sonarScale = 0.5;
      wh.idx = idx;
      scene.add(wh.group);
      whales.push(wh);
    });

    // 2. 10 Tiburones Patrullando en Círculos Amplios
    const sharks = [];
    for (let s = 0; s < 10; s++) {
      const sh = this._createSharkGroup();
      const ang = (s / 10) * Math.PI * 2;
      const radius = 28 + (s % 4) * 9.5;
      const baseY = -14 + (s % 5) * 6.5;
      sh.patrolAngle = ang;
      sh.patrolRadius = radius;
      sh.baseY = baseY;
      sh.speed = 0.22 + (s % 3) * 0.06;
      sh.phase = s * 0.75;
      scene.add(sh.group);
      sharks.push(sh);
    }

    // 3. Cardúmenes Ordenados (250 peces pequeños con amplitud espacial)
    const fishCount = 250;
    const fishGeo = this._createFishGeometry();
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x0e7490,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      metalness: 0.6
    });
    const fishMesh = new THREE.InstancedMesh(fishGeo, fishMat, fishCount);
    fishMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const fishData = [];
    for (let i = 0; i < fishCount; i++) {
      const streamIdx = i % 4;
      const angle = (i / fishCount) * Math.PI * 6 + streamIdx * 1.6;
      const radius = 24 + (i % 26) * 1.25;
      const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        (streamIdx - 1.5) * 7.5 + Math.sin(i * 0.4) * 4,
        Math.sin(angle) * radius - 10
      );
      const vel = new THREE.Vector3(-Math.sin(angle) * 7.5, 0, Math.cos(angle) * 7.5);
      const baseHue = (0.50 + (streamIdx * 0.09) + (i % 20) * 0.008) % 1.0;
      this._colorA.setHSL(baseHue, 0.92, 0.62);
      fishMesh.setColorAt(i, this._colorA);
      fishData.push({ pos, vel, baseHue, streamIdx, phase: i * 0.22, scale: 0.8 + (i % 4) * 0.12 });
    }
    if (fishMesh.instanceColor) fishMesh.instanceColor.needsUpdate = true;
    scene.add(fishMesh);

    // 4. 12 Mantarrayas (diamantes planos que aletean como aves marinas)
    const mantaCount = 12;
    const mantaBodyGeo = new THREE.BoxGeometry(2.6, 0.22, 2.6);
    mantaBodyGeo.rotateY(Math.PI / 4);
    mantaBodyGeo.scale(1.1, 1.0, 1.3);
    const mantaWingGeo = new THREE.BufferGeometry();
    const wingVerts = new Float32Array([
      0, 0, 1.4,
      4.4, 0, -0.35,
      0, 0, -1.9
    ]);
    mantaWingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
    mantaWingGeo.computeVertexNormals();

    const mantaMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.65,
      side: THREE.DoubleSide
    });
    const mantaBodyMesh = new THREE.InstancedMesh(mantaBodyGeo, mantaMat, mantaCount);
    const mantaWingLMesh = new THREE.InstancedMesh(mantaWingGeo, mantaMat, mantaCount);
    const mantaWingRMesh = new THREE.InstancedMesh(mantaWingGeo, mantaMat, mantaCount);
    mantaBodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mantaWingLMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mantaWingRMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mantaBodyMesh, mantaWingLMesh, mantaWingRMesh);

    const mantas = [];
    for (let i = 0; i < mantaCount; i++) {
      const ang = (i / mantaCount) * Math.PI * 2;
      const rad = 32 + (i % 3) * 12;
      mantas.push({
        pos: new THREE.Vector3(Math.cos(ang) * rad, -10 + (i % 4) * 6, Math.sin(ang) * rad - 14),
        angle: ang,
        radius: rad,
        baseY: -10 + (i % 4) * 6,
        speed: 0.20 + (i % 3) * 0.05,
        phase: i * 0.78,
        scale: 1.05 + (i % 3) * 0.18
      });
    }

    // 5. 30 Medusas Translúcidas con Tentáculos (amplia distribución espacial)
    const jellyCount = 30;
    const jellyGeo = this._createJellyfishGeometry();
    const jellyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xc026d3,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.25,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide
    });
    const jellyMesh = new THREE.InstancedMesh(jellyGeo, jellyMat, jellyCount);
    jellyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tentacleGeo = this._createJellyfishTentaclesGeometry();
    const tentacleMat = new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const jellyTentacleMesh = new THREE.InstancedMesh(tentacleGeo, tentacleMat, jellyCount);
    jellyTentacleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const jellies = [];
    for (let i = 0; i < jellyCount; i++) {
      const ang = i * 2.39996;
      const rad = 22 + Math.sqrt(i / jellyCount) * 48;
      const basePos = new THREE.Vector3(
        Math.cos(ang) * rad,
        -18 + (i % 7) * 6.2,
        Math.sin(ang) * rad - 15
      );
      const hue = (0.76 + (i % 8) * 0.038) % 1.0;
      this._colorA.setHSL(hue, 0.88, 0.65);
      jellyMesh.setColorAt(i, this._colorA);
      jellies.push({
        pos: basePos.clone(),
        homePos: basePos.clone(),
        avoidOffset: new THREE.Vector3(),
        phase: i * 0.55,
        hue,
        alert: 0
      });
    }
    if (jellyMesh.instanceColor) jellyMesh.instanceColor.needsUpdate = true;
    scene.add(jellyMesh, jellyTentacleMesh);

    // Attractor/Food Orbs
    const attractorOrbs = [];
    const orbGeo = new THREE.SphereGeometry(1.1, 14, 14);
    const ringGeo = new THREE.RingGeometry(0.8, 1.4, 28);
    for (let i = 0; i < 6; i++) {
      const orbMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x00ffcc : 0xff44cc,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const orbMesh = new THREE.Mesh(orbGeo, orbMat);
      orbMesh.visible = false;
      const haloSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: i % 2 === 0 ? 0x00ffcc : 0xff44cc,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      haloSprite.scale.set(7.5, 7.5, 1);
      orbMesh.add(haloSprite);
      scene.add(orbMesh);

      const waveMat = new THREE.MeshBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const waveMesh = new THREE.Mesh(ringGeo, waveMat);
      waveMesh.visible = false;
      scene.add(waveMesh);

      attractorOrbs.push({
        active: false,
        energy: 0,
        pos: new THREE.Vector3(),
        mesh: orbMesh,
        halo: haloSprite,
        waveMesh,
        waveMat,
        waveProgress: 1.0,
        wavePos: new THREE.Vector3()
      });
    }

    const w = {
      scene,
      skyDome,
      baseFogDensity,
      waterSurface,
      causticBeams,
      seabedA,
      seabedB,
      slabLen,
      bubblePoints,
      bubblePositions,
      bubbleVels,
      diverHudGroup,
      compassCanvas,
      compassCtx,
      compassTexture,
      sonarHandPivot,
      sonarBlips,
      depthCanvas,
      depthCtx,
      depthTexture,
      whales,
      sharks,
      fishMesh,
      fishCount,
      fishData,
      mantaBodyMesh,
      mantaWingLMesh,
      mantaWingRMesh,
      mantas,
      jellyMesh,
      jellyTentacleMesh,
      jellies,
      attractorOrbs,
      diveDistance: 0.0,
      currentDepth: 148.4
    };

    this._spawnAquariumOrb(w, false);
    this._spawnAquariumOrb(w, false);

    return w;
  }

  _spawnAquariumOrb(w, atPointer = false) {
    if (!w || !w.attractorOrbs) return;
    let slot = w.attractorOrbs.find(o => !o.active);
    if (!slot) slot = w.attractorOrbs[0];

    slot.active = true;
    slot.energy = 1.0;
    if (atPointer) {
      slot.pos.set(this.pointer.x * 26, 2 + this.pointer.y * 14, -18);
    } else {
      const ang = this.time * 1.7 + Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 22;
      slot.pos.set(Math.cos(ang) * r, -6 + Math.random() * 18, Math.sin(ang) * r - 14);
    }
    slot.mesh.position.copy(slot.pos);
    slot.mesh.visible = true;
  }

  _updateAquariumWorld(w, dt, audio, P, audioEnergy) {
    this._updateWorldAtmosphere(w, audio, dt);

    // Spawn new Bioluminescent Food Orb on Bass hit > 0.45 or Bio-Pulse
    if ((audio.rawBass > 0.45 || (this.bioPulse || 0) > 0.7) && (this.time - this.lastOrbSpawnTime) > 0.65) {
      this.lastOrbSpawnTime = this.time;
      this._spawnAquariumOrb(w, false);
    }

    const hasActiveOrb = w.attractorOrbs && w.attractorOrbs.some(o => o.active);
    if (!hasActiveOrb && (this.time - this.lastOrbSpawnTime) > 2.8) {
      this.lastOrbSpawnTime = this.time;
      this._spawnAquariumOrb(w, false);
    }

    // Infinite 360° seafloor treadmill at y = -35
    const diveSpeed = (8 + P.speed * 18 + audio.bass * 12 + (this.bioPulse || 0) * 10) * dt;
    if (w.seabedA && w.seabedB) {
      w.seabedA.position.z += diveSpeed;
      w.seabedB.position.z += diveSpeed;
      if (w.seabedA.position.z > w.slabLen) w.seabedA.position.z -= w.slabLen * 2;
      if (w.seabedB.position.z > w.slabLen) w.seabedB.position.z -= w.slabLen * 2;
    }

    // Luminous water surface ripple at y = +45
    if (w.waterSurface && w.waterSurface.geometry.userData.origY) {
      w.waterSurface.position.x = this.camera.position.x;
      w.waterSurface.position.z = this.camera.position.z;
      const pos = w.waterSurface.geometry.attributes.position;
      const origY = w.waterSurface.geometry.userData.origY;
      for (let i = 0; i < origY.length; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        pos.setY(i, origY[i] + Math.sin(vx * 0.04 + this.time * 1.8) * 1.4 + Math.cos(vz * 0.04 + this.time * 1.4) * 1.4);
      }
      pos.needsUpdate = true;
    }

    // Anchor Diver HUD to camera
    if (this.camera && w.diverHudGroup) {
      w.diverHudGroup.position.copy(this.camera.position);
      w.diverHudGroup.quaternion.copy(this.camera.quaternion);
    }
    if (w.sonarHandPivot) {
      w.sonarHandPivot.rotation.z = -this.time * 2.6;
    }

    // Top Degree Compass rotating live with CAM ORBIT & camera heading
    if (this.camera && w.compassCtx && w.compassTexture) {
      this.camera.getWorldDirection(this._vecA);
      const headingDeg = Math.round(((Math.atan2(this._vecA.x, -this._vecA.z) * 180 / Math.PI) + 360) % 360);
      if (w.lastHeadingDeg !== headingDeg) {
        w.lastHeadingDeg = headingDeg;
        const cCtx = w.compassCtx;
        cCtx.clearRect(0, 0, 512, 72);
        cCtx.fillStyle = 'rgba(2, 20, 36, 0.72)';
        cCtx.fillRect(0, 6, 512, 60);
        cCtx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
        cCtx.lineWidth = 2;
        cCtx.strokeRect(2, 6, 508, 60);

        const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
        cCtx.font = 'bold 14px monospace';
        cCtx.textAlign = 'center';
        for (let deg = 0; deg < 360; deg += 15) {
          let diff = deg - headingDeg;
          while (diff > 180) diff -= 360;
          while (diff < -180) diff += 360;
          if (Math.abs(diff) <= 65) {
            const x = 256 + diff * 3.6;
            const isCard = cardinals[deg] !== undefined;
            cCtx.strokeStyle = isCard ? '#00ffcc' : 'rgba(148, 163, 184, 0.65)';
            cCtx.beginPath();
            cCtx.moveTo(x, 12);
            cCtx.lineTo(x, isCard ? 28 : 22);
            cCtx.stroke();
            if (isCard || deg % 45 === 0) {
              cCtx.fillStyle = isCard ? '#00ffcc' : '#cbd5e1';
              cCtx.fillText(cardinals[deg] || `${deg}°`, x, 44);
            }
          }
        }
        // Center indicator triangle & exact degree readout
        cCtx.fillStyle = '#38bdf8';
        cCtx.beginPath();
        cCtx.moveTo(256, 6);
        cCtx.lineTo(250, 15);
        cCtx.lineTo(262, 15);
        cCtx.closePath();
        cCtx.fill();
        cCtx.fillStyle = '#ffffff';
        cCtx.font = 'bold 15px monospace';
        cCtx.fillText(`${String(headingDeg).padStart(3, '0')}°`, 256, 61);
        w.compassTexture.needsUpdate = true;
      }
    }

    // Dynamic Telemetry Readout (DEPTH, TEMP, O2) on Lower-Right HUD Canvas
    if (w.depthCtx && w.depthTexture) {
      const camAltitudeOffset = this.camera ? (4 - this.camera.position.y) * 1.4 : 0;
      w.currentDepth = Math.max(12, 148.4 + camAltitudeOffset + Math.sin(this.time * 0.25) * 3.6 + audio.bass * 2.5);
      const depthStr = w.currentDepth.toFixed(1);
      const o2Pct = Math.round(94 - Math.abs(Math.sin(this.time * 0.08)) * 3);
      if (w.lastRenderedDepth !== depthStr || w.lastO2 !== o2Pct) {
        w.lastRenderedDepth = depthStr;
        w.lastO2 = o2Pct;
        const ctx = w.depthCtx;
        ctx.clearRect(0, 0, 300, 136);
        ctx.fillStyle = 'rgba(2, 22, 38, 0.78)';
        ctx.fillRect(0, 0, 300, 136);
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, 294, 130);

        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 23px monospace';
        ctx.fillText(`DEPTH: -${depthStr}m`, 16, 40);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`TEMP: 14°C`, 16, 76);

        ctx.fillStyle = o2Pct > 90 ? '#4ade80' : '#fbbf24';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`O2: ${o2Pct}%`, 16, 110);
        w.depthTexture.needsUpdate = true;
      }
    }

    // Rising bubble stream around diver
    if (w.bubblePoints && w.bubblePoints.geometry) {
      const pos = w.bubblePoints.geometry.attributes.position.array;
      const vels = w.bubbleVels || [];
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const spd = (vels[i] || 4.0) * (1.0 + audio.treble * 1.3 + (this.bioPulse || 0) * 0.8);
        pos[idx + 1] += spd * dt;
        pos[idx] += Math.sin(this.time * 2.0 + i) * 0.03;
        if (pos[idx + 1] > 44) {
          pos[idx + 1] = -34;
          pos[idx] = (Math.random() - 0.5) * 110;
          pos[idx + 2] = (Math.random() - 0.5) * 110;
        }
      }
      w.bubblePoints.geometry.attributes.position.needsUpdate = true;
    }

    // Volumetric Caustic Beams
    if (w.causticBeams) {
      for (let i = 0; i < w.causticBeams.length; i++) {
        const b = w.causticBeams[i];
        b.mesh.position.x = b.baseX + Math.sin(this.time * 0.5 + b.phase) * 3.5;
        b.mesh.material.opacity = 0.045 + audio.treble * 0.075 + Math.sin(this.time * 1.4 + b.phase) * 0.018;
      }
    }

    // 1. Update 4 Humpback Whales (pectoral flippers + horizontal V-fluke undulating vertically with bass)
    if (w.whales) {
      for (let i = 0; i < w.whales.length; i++) {
        const wh = w.whales[i];
        wh.swimPhase += dt * (wh.speed + audio.bass * 0.08 + (this.bioPulse || 0) * 0.12);

        const px = Math.sin(wh.swimPhase) * wh.swimRadius;
        const pz = Math.cos(wh.swimPhase) * (wh.swimRadius * 1.05) - 10;
        const py = wh.baseY + Math.sin(wh.swimPhase * 1.5) * 4.5;
        wh.group.position.set(px, py, pz);
        wh.group.rotation.y = wh.swimPhase + Math.PI / 2;
        wh.group.rotation.z = Math.sin(wh.swimPhase * 1.8) * 0.06;

        // Horizontal caudal fluke undulates VERTICALLY with bass
        const flukeWave = Math.sin(this.time * 2.2 + wh.swimPhase) * (0.32 + audio.bass * 0.42);
        if (wh.flukePivot) wh.flukePivot.rotation.x = flukeWave;
        // Long pectoral flippers flap gracefully up & down
        const flipWave = Math.sin(this.time * 1.4 + wh.idx) * (0.22 + audio.mid * 0.18);
        if (wh.flipperLPivot) wh.flipperLPivot.rotation.z = 0.18 + flipWave;
        if (wh.flipperRPivot) wh.flipperRPivot.rotation.z = -0.18 - flipWave;

        // Sonar shockwaves expanding on Bass or Bio-Pulse
        if ((audio.rawBass > 0.48 || (this.bioPulse || 0) > 0.45) && wh.sonarLife <= 0.1) {
          wh.sonarLife = 1.0;
          wh.sonarScale = 0.5;
          if (wh.sonarRing) wh.sonarRing.visible = true;
        }
        if (wh.sonarLife > 0) {
          wh.sonarScale += dt * 24.0;
          wh.sonarLife -= dt * 1.3;
          if (wh.sonarRing) {
            wh.sonarRing.scale.set(wh.sonarScale, wh.sonarScale, 1);
            wh.sonarRing.material.opacity = Math.max(0, wh.sonarLife * 0.65);
            if (wh.sonarLife <= 0) wh.sonarRing.visible = false;
          }
        }
      }
    }

    // 2. Update 10 Sharks (vertical crescent tail oscillating left-right, accelerating with mid)
    if (w.sharks) {
      for (let i = 0; i < w.sharks.length; i++) {
        const sh = w.sharks[i];
        const boost = 1.0 + audio.mid * 1.45 + (this.bioPulse || 0) * 1.6;
        sh.patrolAngle += dt * sh.speed * boost;

        const sx = Math.cos(sh.patrolAngle) * sh.patrolRadius;
        const sz = Math.sin(sh.patrolAngle) * sh.patrolRadius - 8;
        const sy = sh.baseY + Math.sin(this.time * 1.8 + sh.phase) * 2.8;
        sh.group.position.set(sx, sy, sz);

        // Tangent forward heading (-Z forward)
        sh.group.rotation.y = -sh.patrolAngle;

        // Side-to-side tail oscillation
        const tailWag = Math.sin(this.time * (4.6 + audio.mid * 5.2 + (this.bioPulse || 0) * 4.5) + sh.phase) * (0.42 + audio.mid * 0.25);
        if (sh.tailPivot) sh.tailPivot.rotation.y = tailWag;
        if (sh.finL) sh.finL.rotation.z = 0.15 + Math.sin(this.time * 2.2 + sh.phase) * 0.08;
        if (sh.finR) sh.finR.rotation.z = -0.15 - Math.sin(this.time * 2.2 + sh.phase) * 0.08;
      }
    }

    // Update live green sonar blips relative to camera view
    if (this.camera && w.sonarBlips) {
      this._vecA.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this._vecB.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const entities = [];
      if (w.whales) w.whales.forEach(wh => entities.push(wh.group.position));
      if (w.sharks) w.sharks.forEach(sh => entities.push(sh.group.position));
      for (let b = 0; b < w.sonarBlips.length; b++) {
        const blip = w.sonarBlips[b];
        const entPos = entities[b];
        if (!entPos) {
          blip.visible = false;
          continue;
        }
        blip.visible = true;
        this._vecC.subVectors(entPos, this.camera.position);
        const rx = this._vecC.dot(this._vecB);
        const rz = this._vecC.dot(this._vecA);
        const maxRange = 95.0;
        const nx = Math.max(-1, Math.min(1, rx / maxRange));
        const ny = Math.max(-1, Math.min(1, rz / maxRange));
        const len = Math.hypot(nx, ny);
        const clampScale = len > 0.92 ? 0.92 / len : 1.0;
        blip.position.set(nx * clampScale * 0.105, ny * clampScale * 0.105, 0.003);
      }
    }

    // 3. Update 12 Manta Rays (diamond bodies + flapping wings)
    if (w.mantas && w.mantaBodyMesh) {
      for (let i = 0; i < w.mantas.length; i++) {
        const m = w.mantas[i];
        m.angle += dt * m.speed * (0.8 + P.speed * 0.8 + audio.mid * 0.6);
        m.pos.set(
          Math.cos(m.angle) * m.radius,
          m.baseY + Math.sin(this.time * 1.1 + m.phase) * 2.8,
          Math.sin(m.angle) * m.radius - 10
        );

        this._vecA.set(-Math.sin(m.angle), Math.cos(this.time * 1.1 + m.phase) * 0.08, Math.cos(m.angle)).normalize();
        this._vecB.copy(m.pos).add(this._vecA);

        this._dummy.position.copy(m.pos);
        this._dummy.lookAt(this._vecB);
        this._dummy.scale.setScalar(m.scale);
        this._dummy.updateMatrix();
        w.mantaBodyMesh.setMatrixAt(i, this._dummy.matrix);

        const flapAngle = Math.sin(this.time * (3.0 + audio.mid * 4.2) + m.phase) * (0.40 + audio.mid * 0.42);
        this._dummy.rotateZ(flapAngle);
        this._dummy.updateMatrix();
        w.mantaWingLMesh.setMatrixAt(i, this._dummy.matrix);

        this._dummy.rotateZ(-flapAngle * 2);
        this._dummy.scale.set(-m.scale, m.scale, m.scale);
        this._dummy.updateMatrix();
        w.mantaWingRMesh.setMatrixAt(i, this._dummy.matrix);
      }
      w.mantaBodyMesh.instanceMatrix.needsUpdate = true;
      w.mantaWingLMesh.instanceMatrix.needsUpdate = true;
      w.mantaWingRMesh.instanceMatrix.needsUpdate = true;
    }

    // 4. Update 30 Translucent Jellyfish + trailing tentacles
    if (w.jellies && w.jellyMesh) {
      for (let i = 0; i < w.jellies.length; i++) {
        const j = w.jellies[i];
        const pulsePhase = this.time * (2.2 + audio.bass * 2.4) + j.phase;
        const pulseContract = Math.sin(pulsePhase);

        this._vecC.copy(j.homePos);
        this._vecC.y += Math.sin(this.time * 0.85 + j.phase) * 3.8;
        this._vecC.x += Math.cos(this.time * 0.45 + j.phase) * 1.8;

        if (w.mantas) {
          for (let mIdx = 0; mIdx < w.mantas.length; mIdx++) {
            const mPos = w.mantas[mIdx].pos;
            const dx = j.pos.x - mPos.x;
            const dy = j.pos.y - mPos.y;
            const dz = j.pos.z - mPos.z;
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq < 120 && dSq > 0.001) {
              const d = Math.sqrt(dSq);
              const push = ((11.0 - d) / 11.0) * 18.0 * dt;
              j.avoidOffset.x += (dx / d) * push;
              j.avoidOffset.y += ((dy / d) + 0.35) * push;
              j.avoidOffset.z += (dz / d) * push;
              j.alert = Math.min(1.0, j.alert + dt * 4.0);
            }
          }
        }

        j.avoidOffset.multiplyScalar(Math.max(0, 1.0 - dt * 1.8));
        j.alert = Math.max(0, j.alert - dt * 1.5);
        j.pos.copy(this._vecC).add(j.avoidOffset);

        const bellXZ = (0.95 - pulseContract * 0.22) * (1.0 + audio.mid * 0.22);
        const bellY = (1.05 + pulseContract * 0.28) * (1.0 + audio.bass * 0.28);

        this._dummy.position.copy(j.pos);
        this._dummy.rotation.set(j.avoidOffset.z * 0.06, this.time * 0.4 + j.phase, -j.avoidOffset.x * 0.06);
        this._dummy.scale.set(bellXZ, bellY, bellXZ);
        this._dummy.updateMatrix();
        w.jellyMesh.setMatrixAt(i, this._dummy.matrix);
        if (w.jellyTentacleMesh) {
          this._dummy.scale.set(bellXZ * 0.95, 1.0 + pulseContract * 0.15, bellXZ * 0.95);
          this._dummy.updateMatrix();
          w.jellyTentacleMesh.setMatrixAt(i, this._dummy.matrix);
        }

        this._colorA.setHSL((j.hue + j.alert * 0.25) % 1.0, 0.9, 0.60 + j.alert * 0.28 + audio.treble * 0.14);
        w.jellyMesh.setColorAt(i, this._colorA);
      }
      w.jellyMesh.instanceMatrix.needsUpdate = true;
      if (w.jellyMesh.instanceColor) w.jellyMesh.instanceColor.needsUpdate = true;
      if (w.jellyTentacleMesh) w.jellyTentacleMesh.instanceMatrix.needsUpdate = true;
    }

    // 5. Update Bioluminescent Orbs & Consumption Shockwave Rings
    if (w.attractorOrbs) {
      for (let i = 0; i < w.attractorOrbs.length; i++) {
        const orb = w.attractorOrbs[i];
        if (orb.active) {
          orb.pos.y += Math.sin(this.time * 2.5 + i) * 0.03;
          orb.mesh.position.copy(orb.pos);
          const s = (0.6 + orb.energy * 0.75) * (1.0 + audio.bass * 0.3);
          orb.mesh.scale.setScalar(s);
          orb.halo.scale.set(s * 7.5, s * 7.5, 1);

          if (orb.energy <= 0.05) {
            orb.active = false;
            orb.mesh.visible = false;
            orb.waveProgress = 0.0;
            orb.wavePos.copy(orb.pos);
            orb.waveMesh.position.copy(orb.pos);
            orb.waveMesh.visible = true;
          }
        }

        if (orb.waveProgress < 1.0) {
          orb.waveProgress = Math.min(1.0, orb.waveProgress + dt * 1.45);
          const ws = 1.0 + orb.waveProgress * 22.0;
          orb.waveMesh.scale.setScalar(ws);
          orb.waveMesh.lookAt(this.camera.position);
          orb.waveMat.opacity = (1.0 - orb.waveProgress) * 0.85;
          if (orb.waveProgress >= 1.0) {
            orb.waveMesh.visible = false;
          }
        }
      }
    }

    // 6. Update 250 Ordered Schooling Fish (wide spatial spread, never blocking center)
    const swimSpeed = 9.0 + P.speed * 10.0 + audio.bass * 10.0 + (this.bioPulse || 0) * 7.0;
    if (w.fishData && w.fishMesh) {
      for (let i = 0; i < w.fishCount; i++) {
        const f = w.fishData[i];
        let nearestOrb = null;
        let nearestDistSq = 999999;
        if (w.attractorOrbs) {
          for (let oIdx = 0; oIdx < w.attractorOrbs.length; oIdx++) {
            const orb = w.attractorOrbs[oIdx];
            if (!orb.active) continue;
            const dSq = f.pos.distanceToSquared(orb.pos);
            if (dSq < nearestDistSq) {
              nearestDistSq = dSq;
              nearestOrb = orb;
            }
          }
        }

        if (nearestOrb) {
          this._vecA.subVectors(nearestOrb.pos, f.pos);
          const dist = Math.max(0.1, this._vecA.length());
          this._vecA.divideScalar(dist);
          this._vecB.set(-this._vecA.z, Math.sin(this.time * 2.0 + f.phase) * 0.25, this._vecA.x).normalize();

          const approachWeight = dist > 5.0 ? 1.3 : 0.3;
          const swirlWeight = dist < 10.0 ? 1.3 : 0.5;
          f.vel.x += (this._vecA.x * approachWeight + this._vecB.x * swirlWeight) * 20.0 * dt;
          f.vel.y += (this._vecA.y * approachWeight + this._vecB.y * swirlWeight) * 16.0 * dt;
          f.vel.z += (this._vecA.z * approachWeight + this._vecB.z * swirlWeight) * 20.0 * dt;

          if (dist < 5.0) {
            nearestOrb.energy = Math.max(0, nearestOrb.energy - dt * 0.012);
          }
        } else {
          const targetAngle = this.time * 0.4 + f.streamIdx * 1.6 + (i / w.fishCount) * Math.PI * 4;
          const targetR = 26 + Math.sin(this.time * 0.5 + f.streamIdx) * 8;
          this._vecA.set(
            Math.cos(targetAngle) * targetR - f.pos.x,
            (f.streamIdx - 1.5) * 7 + Math.sin(targetAngle * 2) * 3 - f.pos.y,
            Math.sin(targetAngle) * targetR - 10 - f.pos.z
          ).normalize();
          f.vel.addScaledVector(this._vecA, 14.0 * dt);
        }

        const vLen = Math.max(0.001, f.vel.length());
        f.vel.multiplyScalar(swimSpeed / vLen);
        f.pos.addScaledVector(f.vel, dt);

        this._vecC.copy(f.pos).add(f.vel);
        this._dummy.position.copy(f.pos);
        this._dummy.lookAt(this._vecC);
        this._dummy.rotateY(Math.sin(this.time * 14.0 + f.phase) * (0.14 + audio.bass * 0.16));
        const sc = f.scale * (1.0 + audio.bass * 0.22);
        this._dummy.scale.set(sc, sc, sc * 1.15);
        this._dummy.updateMatrix();
        w.fishMesh.setMatrixAt(i, this._dummy.matrix);

        const fedBoost = nearestDistSq < 36 ? 0.20 : 0.0;
        const hue = (f.baseHue + audio.mid * 0.15 + fedBoost) % 1.0;
        this._colorA.setHSL(hue, 0.92, 0.56 + fedBoost + audio.treble * 0.16);
        w.fishMesh.setColorAt(i, this._colorA);
      }
      w.fishMesh.instanceMatrix.needsUpdate = true;
      if (w.fishMesh.instanceColor) w.fishMesh.instanceColor.needsUpdate = true;
    }
  }

  // ============================================================================
  // WORLD 1: 🚗 ENDLESS NIGHT DRIVE 3D (Inspired by endless-drive)
  // - First-person driver POV inside car cabin: windshield frame, dark dashboard,
  //   2 glowing tachometers/speedometers (needles rise with bass & speed), steering
  //   wheel turning with A/D & mouse, rearview mirror + swinging geometric amulet.
  // - Exterior night highway: starry sky, dashed centerline, streetlights, headlight beams.
  // - Dynamic `spawnRoadObject()` triggered by strong bass kicks, Spacebar, or UI button.
  // ============================================================================
  _buildCyberWorld() {
    const scene = new THREE.Scene();
    const baseFogDensity = 0.0068;
    scene.fog = new THREE.FogExp2(0x040614, baseFogDensity);

    const skyDome = this._createSkyDome({
      top: 0x020410,
      horizon: 0x16123b,
      bottom: 0x02030a,
      accent: 0x38bdf8
    });
    scene.add(skyDome);

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x090b16, 0.9);
    scene.add(hemi);

    // Deep starry night sky (1,400 crisp stars)
    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.48;
      const r = 280 + Math.random() * 140;
      starPos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
      starPos[i * 3 + 1] = Math.cos(phi) * r + 10;
      starPos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r - 40;
      const c = i % 5 === 0 ? [0.6, 0.9, 1.0] : (i % 7 === 0 ? [1.0, 0.75, 0.9] : [0.95, 0.97, 1.0]);
      starCol[i * 3] = c[0];
      starCol[i * 3 + 1] = c[1];
      starCol[i * 3 + 2] = c[2];
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      fog: false
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    // Procedural Mountain Ranges flanking both sides of the highway
    const makeMountainRange = (sideX) => {
      const segsX = 36;
      const segsZ = 48;
      const mGeo = new THREE.PlaneGeometry(180, 520, segsX, segsZ);
      mGeo.rotateX(-Math.PI / 2);
      const mPos = mGeo.attributes.position;
      for (let i = 0; i < mPos.count; i++) {
        const vx = mPos.getX(i);
        const vz = mPos.getZ(i);
        const n1 = Math.sin(vx * 0.032 + sideX * 0.05) * Math.cos(vz * 0.024) * 26;
        const n2 = Math.sin(vx * 0.075 + vz * 0.055) * 12;
        const n3 = Math.cos(vx * 0.15 + 1.2) * Math.sin(vz * 0.12) * 5;
        const distRatio = Math.min(1.0, Math.abs(vx) / 80);
        const height = Math.max(0, (n1 + n2 + n3 + 15) * (0.4 + distRatio * 0.8));
        mPos.setY(i, height);
      }
      mGeo.computeVertexNormals();
      const mMat = new THREE.MeshStandardMaterial({
        color: this.isDay ? 0x334155 : 0x090e1a,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
      });
      const mMesh = new THREE.Mesh(mGeo, mMat);
      mMesh.position.set(sideX, -1.0, -80);
      return mMesh;
    };
    const mountLeft = makeMountainRange(-125);
    const mountRight = makeMountainRange(125);
    scene.add(mountLeft, mountRight);

    // Volumetric Glowing Sun (Daytime)
    const sunGroup = new THREE.Group();
    sunGroup.position.set(55, 95, -290);
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(18, 24, 20),
      new THREE.MeshBasicMaterial({ color: 0xfffae5, fog: false })
    );
    const sunCorona = new THREE.Mesh(
      new THREE.RingGeometry(18, 42, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      })
    );
    sunGroup.add(sunCore, sunCorona);
    sunGroup.visible = this.isDay;
    scene.add(sunGroup);

    // Glowing Moon (Nighttime)
    const moonGroup = new THREE.Group();
    moonGroup.position.set(-55, 105, -290);
    const moonCore = new THREE.Mesh(
      new THREE.SphereGeometry(14, 24, 20),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, fog: false })
    );
    const moonCorona = new THREE.Mesh(
      new THREE.RingGeometry(14, 28, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false
      })
    );
    moonGroup.add(moonCore, moonCorona);
    moonGroup.visible = !this.isDay;
    scene.add(moonGroup);

    // Birds in V-formation (Daytime)
    const birdGeo = new THREE.ConeGeometry(0.55, 1.6, 4);
    birdGeo.rotateX(Math.PI / 2);
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, fog: false });
    const birdCount = 9;
    const birdsMesh = new THREE.InstancedMesh(birdGeo, birdMat, birdCount);
    birdsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    birdsMesh.visible = this.isDay;
    scene.add(birdsMesh);
    const flock = { x: -120, y: 78, z: -230, speedX: 18, speedZ: 6 };

    // Airplane crossing at high altitude (Nighttime)
    const airplaneGroup = new THREE.Group();
    airplaneGroup.position.set(-180, 115, -310);
    const planeStrobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
    );
    const planeBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0044, fog: false })
    );
    planeBeacon.position.x = -2.2;
    airplaneGroup.add(planeStrobe, planeBeacon);
    airplaneGroup.visible = !this.isDay;
    scene.add(airplaneGroup);

    // =========================================================================
    // 95-METER TITAN / COLOSSUS (Surprise cinematic encounter from horizon/fog)
    // =========================================================================
    const titanGroup = new THREE.Group();
    titanGroup.position.set(45, -95, -205);
    titanGroup.visible = false;

    const titanMat = new THREE.MeshStandardMaterial({
      color: 0x090f1e,
      roughness: 0.7,
      metalness: 0.6,
      flatShading: true
    });
    const titanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      fog: false
    });

    // Massive Torso / Chest (42m tall)
    const titanTorso = new THREE.Mesh(new THREE.BoxGeometry(26, 42, 16), titanMat);
    titanTorso.position.y = 52;
    titanGroup.add(titanTorso);

    // Glowing Reactor Core (pulses with bass)
    const titanCore = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 16), titanGlowMat);
    titanCore.position.set(0, 56, 8.5);
    titanGroup.add(titanCore);

    // Monumental Head with glowing dual eye slits
    const titanHead = new THREE.Group();
    titanHead.position.set(0, 78, 2);
    const headGeom = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 12), titanMat);
    const eyeGeomL = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 2), titanGlowMat);
    eyeGeomL.position.set(-2.5, 2.5, 6.2);
    const eyeGeomR = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 2), titanGlowMat);
    eyeGeomR.position.set(2.5, 2.5, 6.2);
    titanHead.add(headGeom, eyeGeomL, eyeGeomR);
    titanGroup.add(titanHead);

    // Colossal Shoulder Plates (30m wide)
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 14), titanMat);
    shoulderL.position.set(-19, 70, 0);
    const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(12, 10, 14), titanMat);
    shoulderR.position.set(19, 70, 0);
    titanGroup.add(shoulderL, shoulderR);

    // Articulated Arms (hanging down, swaying slowly with time)
    const armL = new THREE.Group();
    armL.position.set(-21, 65, 0);
    const upperArmL = new THREE.Mesh(new THREE.BoxGeometry(6, 26, 7), titanMat);
    upperArmL.position.y = -13;
    const forearmL = new THREE.Mesh(new THREE.BoxGeometry(5.5, 24, 6.5), titanMat);
    forearmL.position.y = -36;
    armL.add(upperArmL, forearmL);

    const armR = new THREE.Group();
    armR.position.set(21, 65, 0);
    const upperArmR = new THREE.Mesh(new THREE.BoxGeometry(6, 26, 7), titanMat);
    upperArmR.position.y = -13;
    const forearmR = new THREE.Mesh(new THREE.BoxGeometry(5.5, 24, 6.5), titanMat);
    forearmR.position.y = -36;
    armR.add(upperArmR, forearmR);

    titanGroup.add(armL, armR);

    // Monumental Pillar Legs (36m tall)
    const legL = new THREE.Mesh(new THREE.BoxGeometry(9, 36, 10), titanMat);
    legL.position.set(-8.5, 18, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(9, 36, 10), titanMat);
    legR.position.set(8.5, 18, 0);
    titanGroup.add(legL, legR);

    scene.add(titanGroup);

    // =========================================================================
    // INFINITE NIGHT HIGHWAY WITH SMOOTH CURVES & ZERO-INVASION TREADMILL SLABS
    // =========================================================================
    const slabLen = 160;
    const segsZ = 32;
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f1c,
      roughness: 0.75,
      metalness: 0.25
    });
    const groundMatLeft = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.92,
      metalness: 0.05
    });
    const groundMatRight = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.45
    });
    const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const dashLineMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const makeRoadSlab = (zPos) => {
      const g = new THREE.Group();

      // Flanking Left & Right Terrain with sub-segments for bending along curve
      const makeSideTerrain = (centerX, width, mat) => {
        const terrGeo = new THREE.PlaneGeometry(width, slabLen, 6, segsZ);
        terrGeo.rotateX(-Math.PI / 2);
        const terrPos = terrGeo.attributes.position;
        const terrOrigX = new Float32Array(terrPos.count);
        const terrOrigZ = new Float32Array(terrPos.count);
        for (let i = 0; i < terrPos.count; i++) {
          const sx = terrPos.getX(i) + centerX;
          terrPos.setX(i, sx);
          terrOrigX[i] = sx;
          terrOrigZ[i] = terrPos.getZ(i);
        }
        terrGeo.userData = { origX: terrOrigX, origZ: terrOrigZ };
        const terrain = new THREE.Mesh(terrGeo, mat);
        terrain.position.y = -0.06;
        return terrain;
      };
      const terrainLeft = makeSideTerrain(-79, 140, groundMatLeft);
      const terrainRight = makeSideTerrain(79, 140, groundMatRight);
      g.add(terrainLeft, terrainRight);
      g.terrainLeftMesh = terrainLeft;
      g.terrainRightMesh = terrainRight;

      // Asphalt Road (18m wide) with 32 segments along length for smooth wave curves
      const asphaltGeo = new THREE.PlaneGeometry(18, slabLen, 2, segsZ);
      asphaltGeo.rotateX(-Math.PI / 2);
      const asphPos = asphaltGeo.attributes.position;
      const asphOrigX = new Float32Array(asphPos.count);
      const asphOrigZ = new Float32Array(asphPos.count);
      for (let i = 0; i < asphPos.count; i++) {
        asphOrigX[i] = asphPos.getX(i);
        asphOrigZ[i] = asphPos.getZ(i);
      }
      asphaltGeo.userData = { origX: asphOrigX, origZ: asphOrigZ };
      const asphalt = new THREE.Mesh(asphaltGeo, roadMat);
      g.add(asphalt);
      g.asphaltMesh = asphalt;

      // Left and Right Edge lines (segmented to curve smoothly with asphalt)
      const makeEdgeLine = (lx) => {
        const edgeGeo = new THREE.PlaneGeometry(0.28, slabLen, 1, segsZ);
        edgeGeo.rotateX(-Math.PI / 2);
        const ep = edgeGeo.attributes.position;
        const eox = new Float32Array(ep.count);
        const eoz = new Float32Array(ep.count);
        for (let i = 0; i < ep.count; i++) {
          eox[i] = ep.getX(i) + lx;
          eoz[i] = ep.getZ(i);
          ep.setX(i, eox[i]);
        }
        edgeGeo.userData = { origX: eox, origZ: eoz };
        const edge = new THREE.Mesh(edgeGeo, edgeLineMat);
        edge.position.y = 0.02;
        return edge;
      };
      const edgeL = makeEdgeLine(-8.5);
      const edgeR = makeEdgeLine(8.5);
      g.add(edgeL, edgeR);
      g.edgeL = edgeL;
      g.edgeR = edgeR;

      // Central dashed stripes
      const dashGeo = new THREE.PlaneGeometry(0.26, 4.8);
      dashGeo.rotateX(-Math.PI / 2);
      const dashes = [];
      for (let d = -slabLen * 0.5 + 5; d < slabLen * 0.5; d += 10) {
        const dash = new THREE.Mesh(dashGeo, dashLineMat);
        dash.position.set(0, 0.02, d);
        g.add(dash);
        dashes.push({ mesh: dash, localZ: d });
      }
      g.dashes = dashes;

      // Reflective water puddles on asphalt (visible only during Rain / Thunderstorm)
      const puddleMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.04,
        metalness: 0.92,
        transparent: true,
        opacity: 0.85
      });
      const puddleGeo = new THREE.PlaneGeometry(3.6, 7.2);
      puddleGeo.rotateX(-Math.PI / 2);
      const puddles = [];
      for (let p = 0; p < 4; p++) {
        const puddle = new THREE.Mesh(puddleGeo, puddleMat);
        const pz = -slabLen * 0.35 + p * 28;
        const px = (p % 2 === 0 ? -3.5 : 3.5);
        puddle.position.set(px, 0.012, pz);
        puddle.rotation.y = p * 0.4;
        puddle.name = 'roadPuddle';
        puddle.visible = false;
        g.add(puddle);
        puddles.push({ mesh: puddle, localX: px, localZ: pz });
      }
      g.puddles = puddles;

      g.position.z = zPos;
      return g;
    };

    const slabA = makeRoadSlab(0);
    const slabB = makeRoadSlab(-slabLen);
    scene.add(slabA, slabB);

    // 24 Roadside Streetlights (12 pairs along curve fringe)
    const lampCount = 24;
    const poleGeo = new THREE.CylinderGeometry(0.11, 0.15, 7.6, 6);
    poleGeo.translate(0, 3.8, 0);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const lampPoleMesh = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
    lampPoleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const bulbGeo = new THREE.SphereGeometry(0.38, 10, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
    const lampBulbMesh = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount);
    lampBulbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const lamps = [];
    const lampSpacing = 16;
    for (let i = 0; i < lampCount; i++) {
      const row = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      lamps.push({
        side,
        x: side * 11.2,
        z: 24 - row * lampSpacing
      });
    }
    scene.add(lampPoleMesh, lampBulbMesh);

    // =========================================================================
    // FIRST-PERSON CAR CABIN RIG (HIGHLY DETAILED, ENDLESS DRIVE STYLE)
    // =========================================================================
    const cabinGroup = new THREE.Group();
    scene.add(cabinGroup);

    const dashMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.65, metalness: 0.35 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x161e2e, roughness: 0.4, metalness: 0.6 });

    // 1. Windshield frame: angled A-pillars + top header + sculpted dashboard
    const pillarGeo = new THREE.BoxGeometry(0.14, 1.85, 0.18);
    const leftPillar = new THREE.Mesh(pillarGeo, dashMat);
    leftPillar.position.set(-1.35, 0.12, -1.35);
    leftPillar.rotation.set(0.28, 0, -0.22);
    const rightPillar = new THREE.Mesh(pillarGeo, dashMat);
    rightPillar.position.set(1.35, 0.12, -1.35);
    rightPillar.rotation.set(0.28, 0, 0.22);

    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.22), dashMat);
    roofBar.position.set(0, 0.88, -1.2);

    const dashBody = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.55, 0.9), dashMat);
    dashBody.position.set(0, -0.66, -1.22);

    const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.35), trimMat);
    hoodMesh.position.set(0, -0.58, -2.05);
    hoodMesh.rotation.x = 0.08;
    cabinGroup.add(leftPillar, rightPillar, roofBar, dashBody, hoodMesh);

    // Left Wing Mirror on left A-pillar
    const wingMirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.12), trimMat);
    wingMirrorHousing.position.set(-1.48, -0.04, -1.26);
    wingMirrorHousing.rotation.set(0.1, 0.35, -0.15);
    const wingMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.11), new THREE.MeshBasicMaterial({ color: 0x08101e }));
    wingMirrorGlass.position.set(-1.46, -0.04, -1.21);
    wingMirrorGlass.rotation.set(0.1, 0.35, -0.15);
    const wingMirrorLight = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshBasicMaterial({ color: 0xff1144 }));
    wingMirrorLight.position.set(-1.45, -0.04, -1.20);
    wingMirrorLight.rotation.set(0.1, 0.35, -0.15);
    cabinGroup.add(wingMirrorHousing, wingMirrorGlass, wingMirrorLight);

    // Headlight Illumination Projections onto the Asphalt Ahead
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beamConeGeo = new THREE.PlaneGeometry(5.5, 36);
    beamConeGeo.rotateX(-Math.PI / 2);
    const headBeamL = new THREE.Mesh(beamConeGeo, beamMat);
    headBeamL.position.set(-1.1, -2.38, -21);
    const headBeamR = new THREE.Mesh(beamConeGeo, beamMat);
    headBeamR.position.set(1.1, -2.38, -21);
    cabinGroup.add(headBeamL, headBeamR);

    // 2. Dual Circular Detailed Dials (Tachometer & Speedometer with graduated radial tick marks)
    const makeDetailedGauge = (gx, ringColor, needleColor) => {
      const g = new THREE.Group();
      g.position.set(gx, -0.34, -0.96);
      g.rotation.x = -0.22;

      // Dark face
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(0.135, 24),
        new THREE.MeshBasicMaterial({ color: 0x030712 })
      );
      // Outer colored glow rim
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(0.125, 0.145, 28),
        new THREE.MeshBasicMaterial({ color: ringColor })
      );
      rim.position.z = 0.002;

      // Graduated radial tick marks
      const tickGeo = new THREE.BoxGeometry(0.006, 0.022, 0.002);
      const tickMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
      for (let t = 0; t < 9; t++) {
        const ang = -Math.PI * 0.75 + (t / 8) * Math.PI * 1.5;
        const tick = new THREE.Mesh(tickGeo, tickMat);
        tick.position.set(Math.cos(ang) * 0.108, Math.sin(ang) * 0.108, 0.003);
        tick.rotation.z = ang - Math.PI / 2;
        g.add(tick);
      }

      // Reactive needle with pivot
      const needlePivot = new THREE.Group();
      needlePivot.position.z = 0.006;
      const needleBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.105, 0.005),
        new THREE.MeshBasicMaterial({ color: needleColor })
      );
      needleBar.position.y = 0.045;
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
      cap.position.z = 0.003;
      needlePivot.add(needleBar, cap);

      g.add(face, rim, needlePivot);
      cabinGroup.add(g);
      return needlePivot;
    };
    const needleTach = makeDetailedGauge(-0.46, 0x00f0ff, 0x10b981); // RPM Dial
    const needleSpeed = makeDetailedGauge(-0.14, 0xf472b6, 0xef4444); // Speed Dial

    // 3. Central Radio Screen with 16 Animated FFT Equalizer Bars (40Hz - 12kHz)
    const radioScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.20),
      new THREE.MeshBasicMaterial({ color: 0x050a16 })
    );
    radioScreen.position.set(0.22, -0.36, -0.98);
    radioScreen.rotation.x = -0.22;
    cabinGroup.add(radioScreen);

    const fftBars = [];
    const barGeo = new THREE.BoxGeometry(0.015, 0.12, 0.005);
    barGeo.translate(0, 0.06, 0); // Scale up from bottom
    for (let b = 0; b < 16; b++) {
      // Bass = Cyan (0.50), Mid = Green/Yellow (0.34 -> 0.16), Treble = Magenta (0.85)
      let barHue;
      if (b < 5) barHue = 0.52 - (b / 5) * 0.06;
      else if (b < 11) barHue = 0.36 - ((b - 5) / 6) * 0.22;
      else barHue = 0.92 - ((b - 11) / 5) * 0.08;
      const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(barHue, 1.0, 0.56) });
      const barMesh = new THREE.Mesh(barGeo, barMat);
      barMesh.position.set(-0.15 + b * 0.020, -0.075, 0.004);
      barMesh.scale.y = 0.15;
      radioScreen.add(barMesh);
      fftBars.push(barMesh);
    }

    // 4. Digital LED Counter (`KM / BPM` + Current Biome Name) on dashboard
    const ledCanvas = document.createElement('canvas');
    ledCanvas.width = 256;
    ledCanvas.height = 84;
    const ledCtx = ledCanvas.getContext('2d');
    const ledTexture = new THREE.CanvasTexture(ledCanvas);
    const ledMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.115),
      new THREE.MeshBasicMaterial({ map: ledTexture, transparent: true })
    );
    ledMesh.position.set(-0.74, -0.34, -0.96);
    ledMesh.rotation.x = -0.22;
    cabinGroup.add(ledMesh);

    // 5. Sport Steering Wheel lowered so both dials stay 100% visible
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(-0.30, -0.58, -0.78);
    wheelGroup.rotation.x = -0.36;

    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.024, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.7 })
    );
    const wheelHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.058, 0.03, 16),
      trimMat
    );
    wheelHub.rotation.x = Math.PI / 2;
    const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.028, 0.02), trimMat);
    const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.21, 0.02), trimMat);
    spokeV.position.y = -0.10;
    const topMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.048, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    topMarker.position.y = 0.21;
    wheelGroup.add(wheelRim, wheelHub, spokeH, spokeV, topMarker);
    cabinGroup.add(wheelGroup);

    // 6. Top Rearview Mirror with Taillight Reflections & Hanging Geometric Amulet
    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.04), trimMat);
    mirrorHousing.position.set(0, 0.68, -1.06);
    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.40, 0.095),
      new THREE.MeshBasicMaterial({ color: 0x08101e })
    );
    mirrorGlass.position.set(0, 0.68, -1.038);

    // Trailing car taillights visible in rearview mirror
    const mirrorLightL = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshBasicMaterial({ color: 0xff1144 }));
    mirrorLightL.position.set(-0.06, 0.68, -1.035);
    const mirrorLightR = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), new THREE.MeshBasicMaterial({ color: 0xff1144 }));
    mirrorLightR.position.set(0.06, 0.68, -1.035);
    cabinGroup.add(mirrorHousing, mirrorGlass, mirrorLightL, mirrorLightR);

    // Sacred Geometry Amulet / Dreamcatcher hanging on cord
    const amuletPivot = new THREE.Group();
    amuletPivot.position.set(0, 0.62, -1.04);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.16, 4),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
    );
    cord.position.y = -0.08;
    const crystalAmulet = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.052, 0),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    crystalAmulet.position.y = -0.19;
    const crystalWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.065, 0),
      new THREE.MeshBasicMaterial({ color: 0xf472b6, wireframe: true })
    );
    crystalWire.position.y = -0.19;
    amuletPivot.add(cord, crystalAmulet, crystalWire);
    cabinGroup.add(amuletPivot);

    // =========================================================================
    // 4 DISTINCT BIOMES SCENERY RIGS
    // =========================================================================
    // Biome 0: COSTA TROPICAL (Playa dorada izquierda + Océano turquesa derecha con olas espumosas)
    const oceanGroup = new THREE.Group();
    const oceanGeo = new THREE.PlaneGeometry(170, 540, 28, 36);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanOrigY = new Float32Array(oceanGeo.attributes.position.count);
    oceanGeo.userData = { origY: oceanOrigY };
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0369a1,
      emissiveIntensity: 0.28,
      roughness: 0.14,
      metalness: 0.65,
      flatShading: true
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(96, -0.45, -80);
    oceanGroup.add(oceanMesh);

    // Animated white foamy shore waves along x = +12..+22
    const foamStrips = [];
    const foamGeo = new THREE.PlaneGeometry(3.2, 520, 4, 32);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    for (let f = 0; f < 3; f++) {
      const foam = new THREE.Mesh(foamGeo, foamMat.clone());
      foam.position.set(13.5 + f * 4.5, 0.04, -80);
      oceanGroup.add(foam);
      foamStrips.push({ mesh: foam, baseX: 13.5 + f * 4.5, phase: f * 2.1 });
    }

    const sailboats = [];
    for (let sb = 0; sb < 5; sb++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.3, 8.8), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
      hull.position.y = 0.5;
      const sail = new THREE.Mesh(new THREE.ConeGeometry(3.4, 8.2, 3), new THREE.MeshBasicMaterial({ color: sb % 2 === 0 ? 0xfbbf24 : 0xf43f5e }));
      sail.rotation.y = Math.PI * 0.25;
      sail.position.set(0, 4.9, 0);
      boat.add(hull, sail);
      boat.position.set(52 + sb * 16, -0.2, -50 - sb * 55);
      oceanGroup.add(boat);
      sailboats.push(boat);
    }
    const lighthouse = new THREE.Group();
    const lhTower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.8, 22, 10), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 }));
    lhTower.position.y = 11;
    const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 4.5, 10), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    lhTop.position.y = 23;
    const lhBeam = new THREE.Mesh(new THREE.ConeGeometry(12, 65, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    lhBeam.rotateX(Math.PI / 2);
    lhBeam.position.set(0, 23, 30);
    lighthouse.add(lhTower, lhTop, lhBeam);
    lighthouse.position.set(36, -0.5, -110);
    oceanGroup.add(lighthouse);
    scene.add(oceanGroup);

    // Biome 1: VALLE VOLCÁNICO (Roca negra basáltica, ríos de lava paralelos y 4 volcanes gigantes)
    const volcanoGroup = new THREE.Group();
    const makeVolcano = (vx, vz, rad, ht) => {
      const g = new THREE.Group();
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(rad, ht, 14, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95, flatShading: true })
      );
      cone.position.y = ht * 0.5;
      const crater = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.30, 12), new THREE.MeshBasicMaterial({ color: 0xff3b00, side: THREE.DoubleSide }));
      crater.rotateX(-Math.PI / 2);
      crater.position.y = ht - 0.3;
      g.add(cone, crater);
      g.position.set(vx, -1.0, vz);
      return { group: g, crater, ht };
    };
    const volc1 = makeVolcano(-120, -145, 48, 66);
    const volc2 = makeVolcano(125, -195, 54, 76);
    const volc3 = makeVolcano(-145, -265, 60, 84);
    const volc4 = makeVolcano(105, -95, 38, 52);
    volcanoGroup.add(volc1.group, volc2.group, volc3.group, volc4.group);

    // Parallel glowing lava rivers running along both sides of the highway
    const lavaRiverGeo = new THREE.PlaneGeometry(8.5, 520, 4, 32);
    lavaRiverGeo.rotateX(-Math.PI / 2);
    const lavaRiverMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
    const lavaRiverL = new THREE.Mesh(lavaRiverGeo, lavaRiverMat);
    lavaRiverL.position.set(-28, 0.03, -80);
    const lavaRiverR = new THREE.Mesh(lavaRiverGeo, lavaRiverMat);
    lavaRiverR.position.set(28, 0.03, -80);
    volcanoGroup.add(lavaRiverL, lavaRiverR);

    const volcList = [volc1, volc2, volc3, volc4];
    const lavaCount = 220;
    const lavaGeo = new THREE.BufferGeometry();
    const lavaPos = new Float32Array(lavaCount * 3);
    const lavaVels = [];
    for (let lp = 0; lp < lavaCount; lp++) {
      const sourceVolc = volcList[lp % volcList.length];
      lavaPos[lp * 3] = sourceVolc.group.position.x + (Math.random() - 0.5) * 10;
      lavaPos[lp * 3 + 1] = sourceVolc.ht + Math.random() * 40;
      lavaPos[lp * 3 + 2] = sourceVolc.group.position.z + (Math.random() - 0.5) * 10;
      lavaVels.push({
        vx: (Math.random() - 0.5) * 7,
        vy: 18 + Math.random() * 28,
        vz: (Math.random() - 0.5) * 7,
        baseY: sourceVolc.ht - 2,
        source: sourceVolc
      });
    }
    lavaGeo.setAttribute('position', new THREE.BufferAttribute(lavaPos, 3));
    const lavaMat = new THREE.PointsMaterial({
      size: 3.4,
      color: 0xff6b00,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const lavaParticles = new THREE.Points(lavaGeo, lavaMat);
    volcanoGroup.add(lavaParticles);
    scene.add(volcanoGroup);

    // Biome 2: METRÓPOLIS CYBER (Rascacielos iluminados con ventanas neón y puentes de luz)
    const synthwaveGroup = new THREE.Group();
    const winCanvas = document.createElement('canvas');
    winCanvas.width = 64;
    winCanvas.height = 128;
    const wCtx = winCanvas.getContext('2d');
    wCtx.fillStyle = '#090d1a';
    wCtx.fillRect(0, 0, 64, 128);
    for (let wy = 4; wy < 124; wy += 8) {
      for (let wx = 4; wx < 60; wx += 10) {
        if (((wx * 7 + wy * 13) % 5) !== 0) {
          wCtx.fillStyle = ((wx + wy) % 3 === 0) ? '#38bdf8' : ((wx % 2 === 0) ? '#f472b6' : '#fef08a');
          wCtx.fillRect(wx, wy, 6, 4);
        }
      }
    }
    const winTexture = new THREE.CanvasTexture(winCanvas);
    winTexture.wrapS = THREE.RepeatWrapping;
    winTexture.wrapT = THREE.RepeatWrapping;
    winTexture.repeat.set(2, 4);

    const towerMat1 = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      map: winTexture,
      emissive: 0x1e293b,
      emissiveMap: winTexture,
      emissiveIntensity: 0.95,
      roughness: 0.3,
      metalness: 0.7
    });
    const towerGlowMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, wireframe: true });
    const towerCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true });
    for (let tw = 0; tw < 16; tw++) {
      const side = tw % 2 === 0 ? -1 : 1;
      const th = 48 + (tw * 13) % 62;
      const twr = new THREE.Group();
      const bld = new THREE.Mesh(new THREE.BoxGeometry(16, th, 16), towerMat1);
      bld.position.y = th * 0.5;
      const wire = new THREE.Mesh(new THREE.BoxGeometry(16.4, th + 0.4, 16.4), tw % 2 === 0 ? towerGlowMat : towerCyanMat);
      wire.position.y = th * 0.5;
      twr.add(bld, wire);
      twr.position.set(side * (65 + (tw % 4) * 20), -1.0, -70 - tw * 22);
      synthwaveGroup.add(twr);
    }
    // Overhead Neon Light Bridges spanning across the highway
    for (let br = 0; br < 4; br++) {
      const bridge = new THREE.Mesh(
        new THREE.TorusGeometry(28, 0.55, 8, 24, Math.PI),
        new THREE.MeshBasicMaterial({ color: br % 2 === 0 ? 0x00f0ff : 0xf43f5e })
      );
      bridge.position.set(0, -1, -75 - br * 65);
      synthwaveGroup.add(bridge);
    }
    scene.add(synthwaveGroup);

    // Biome 3: DESIERTO ROJO (Mesetas tipo Grand Canyon, cactus saguaro y pirámides escalonadas)
    const desertGroup = new THREE.Group();
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.92, flatShading: true });
    const mesaTopMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.95 });
    for (let ms = 0; ms < 6; ms++) {
      const side = ms % 2 === 0 ? -1 : 1;
      const mesa = new THREE.Group();
      const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(28, 38, 22, 7), mesaMat);
      tier1.position.y = 11;
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(18, 25, 16, 7), mesaTopMat);
      tier2.position.y = 29;
      mesa.add(tier1, tier2);
      mesa.position.set(side * (88 + (ms % 2) * 32), -1, -90 - ms * 48);
      desertGroup.add(mesa);
    }
    // Stepped Desert Pyramids
    const stepMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85, flatShading: true });
    [-110, 115].forEach((px, pIdx) => {
      const stepPyr = new THREE.Group();
      for (let st = 0; st < 5; st++) {
        const wStep = 46 - st * 8;
        const block = new THREE.Mesh(new THREE.BoxGeometry(wStep, 7.5, wStep), stepMat);
        block.position.y = 3.75 + st * 7.5;
        stepPyr.add(block);
      }
      stepPyr.position.set(px, -0.5, -175 - pIdx * 45);
      desertGroup.add(stepPyr);
    });
    scene.add(desertGroup);

    const biomes = [
      'COSTA TROPICAL',
      'VALLE VOLCÁNICO',
      'METRÓPOLIS CYBER',
      'DESIERTO ROJO'
    ];
    let currentBiomeIndex = 0;
    const applyBiomePalette = (bIdx, dayFlag) => {
      if (skyDome && skyDome.material && skyDome.material.uniforms) {
        const u = skyDome.material.uniforms;
        if (bIdx === 0) {
          u.uTopColor.value.setHex(dayFlag ? 0x0284c7 : 0x061e3f);
          u.uHorizonColor.value.setHex(dayFlag ? 0x67e8f9 : 0x0ea5e9);
          u.uBottomColor.value.setHex(0x020a17);
          u.uAccentColor.value.setHex(0xfde047);
          if (scene.fog) scene.fog.color.setHex(dayFlag ? 0x38bdf8 : 0x071b30);
          groundMatLeft.color.setHex(0xeab308);
          groundMatRight.color.setHex(0x06b6d4);
        } else if (bIdx === 1) {
          u.uTopColor.value.setHex(dayFlag ? 0x450a0a : 0x230909);
          u.uHorizonColor.value.setHex(0xe11d48);
          u.uBottomColor.value.setHex(0x0c0303);
          u.uAccentColor.value.setHex(0xf97316);
          if (scene.fog) scene.fog.color.setHex(0x2a0808);
          groundMatLeft.color.setHex(0x1c1917);
          groundMatRight.color.setHex(0x1c1917);
        } else if (bIdx === 2) {
          u.uTopColor.value.setHex(dayFlag ? 0x311052 : 0x18052e);
          u.uHorizonColor.value.setHex(0xd946ef);
          u.uBottomColor.value.setHex(0x080214);
          u.uAccentColor.value.setHex(0x06b6d4);
          if (scene.fog) scene.fog.color.setHex(0x140424);
          groundMatLeft.color.setHex(0x0a0518);
          groundMatRight.color.setHex(0x0a0518);
        } else {
          u.uTopColor.value.setHex(dayFlag ? 0xea580c : 0x2b1205);
          u.uHorizonColor.value.setHex(0xfb923c);
          u.uBottomColor.value.setHex(0x1a0902);
          u.uAccentColor.value.setHex(0xfbbf24);
          if (scene.fog) scene.fog.color.setHex(dayFlag ? 0xd97706 : 0x261105);
          groundMatLeft.color.setHex(0xb45309);
          groundMatRight.color.setHex(0xc2410c);
        }
      }
    };

    const cycleBiome = (manual = false) => {
      currentBiomeIndex = (currentBiomeIndex + 1) % 4;
      const bIdx = currentBiomeIndex;
      w.currentBiomeIndex = bIdx;
      w.biomeTimer = 0.0;
      oceanGroup.visible = (bIdx === 0);
      volcanoGroup.visible = (bIdx === 1);
      synthwaveGroup.visible = (bIdx === 2);
      desertGroup.visible = (bIdx === 3);
      applyBiomePalette(bIdx, this.isDay);
      if (w.roadObjects) {
        w.roadObjects.forEach(o => { o.active = false; o.mesh.visible = false; });
        for (let s = 0; s < 10; s++) {
          this._activateRoadSlot(w, -20 - s * 18);
        }
      }
      return biomes[currentBiomeIndex];
    };

    // Initial Biome: Costa Tropical
    oceanGroup.visible = true;
    volcanoGroup.visible = false;
    synthwaveGroup.visible = false;
    desertGroup.visible = false;

    // =========================================================================
    // POOL OF 48 BIOME-MATCHED ROADSIDE OBJECTS (STRICT ZERO-INVASION: |x-curve| >= 16)
    // =========================================================================
    const roadObjects = [];
    const buildRoadObjectMesh = (kindIdx) => {
      const g = new THREE.Group();
      if (kindIdx === 0) {
        // Palmera Tropical con tronco curvo y 7 hojas verdes en estrella (Costa)
        for (let seg = 0; seg < 4; seg++) {
          const trunkSeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32 - seg * 0.04, 0.38 - seg * 0.04, 2.0, 6),
            new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
          );
          trunkSeg.position.set(seg * 0.35, 1.0 + seg * 1.85, 0);
          trunkSeg.rotation.z = -0.14 - seg * 0.05;
          g.add(trunkSeg);
        }
        for (let p = 0; p < 7; p++) {
          const frond = new THREE.Mesh(
            new THREE.ConeGeometry(0.95, 4.8, 4),
            new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 })
          );
          frond.position.set(1.2, 7.6, 0);
          frond.rotation.z = 1.15;
          frond.rotation.y = (p / 7) * Math.PI * 2;
          g.add(frond);
        }
      } else if (kindIdx === 1) {
        // Sombrilla de Playa Colorida (Costa)
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })
        );
        pole.position.y = 1.8;
        const canopy = new THREE.Mesh(
          new THREE.ConeGeometry(2.6, 1.1, 8),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 })
        );
        canopy.position.y = 3.5;
        g.add(pole, canopy);
      } else if (kindIdx === 2) {
        // Mini Volcán con cráter incandescente (Volcán)
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(4.8, 8.5, 8, 1, true),
          new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.95, flatShading: true })
        );
        cone.position.y = 4.25;
        const crater = new THREE.Mesh(new THREE.CircleGeometry(1.4, 8), new THREE.MeshBasicMaterial({ color: 0xff4500, side: THREE.DoubleSide }));
        crater.rotateX(-Math.PI / 2);
        crater.position.y = 8.4;
        g.add(cone, crater);
      } else if (kindIdx === 3) {
        // Columna de Basalto Hexagonal (Volcán)
        for (let c = 0; c < 5; c++) {
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.65, 0.72, 4.5 + c * 1.1, 6),
            new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.35, metalness: 0.75 })
          );
          col.position.set((c - 2) * 1.0, (4.5 + c * 1.1) * 0.5, (c % 2) * 0.7);
          g.add(col);
        }
      } else if (kindIdx === 4) {
        // Rascacielos Neón con Ventanas Iluminadas (Metrópolis)
        const box = new THREE.Mesh(new THREE.BoxGeometry(4.2, 12.5, 4.2), towerMat1);
        box.position.y = 6.25;
        const wire = new THREE.Mesh(new THREE.BoxGeometry(4.4, 12.7, 4.4), new THREE.MeshBasicMaterial({ color: 0xd946ef, wireframe: true }));
        wire.position.y = 6.25;
        g.add(box, wire);
      } else if (kindIdx === 5) {
        // Arco de Luz Cyber (Metrópolis)
        const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.25, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
        arch.position.y = 0;
        g.add(arch);
      } else if (kindIdx === 6) {
        // Cactus Gigante Saguaro Verde (Desierto)
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 7.5, 8), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 }));
        trunk.position.y = 3.75;
        const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.8, 6), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 }));
        armL.position.set(-1.1, 4.2, 0);
        armL.rotation.z = 0.5;
        const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 6), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 }));
        armR.position.set(1.1, 5.0, 0);
        armR.rotation.z = -0.5;
        g.add(trunk, armL, armR);
      } else {
        // Pirámide Escalonada (Desierto)
        for (let st = 0; st < 3; st++) {
          const sW = 5.4 - st * 1.5;
          const block = new THREE.Mesh(new THREE.BoxGeometry(sW, 1.7, sW), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 }));
          block.position.y = 0.85 + st * 1.7;
          g.add(block);
        }
      }
      g.visible = false;
      scene.add(g);
      return g;
    };

    for (let i = 0; i < 48; i++) {
      const kindIdx = i % 8;
      const mesh = buildRoadObjectMesh(kindIdx);
      roadObjects.push({
        active: false,
        kindIdx,
        mesh,
        side: 1,
        distFromRoad: 18.0,
        x: 0,
        z: -200,
        bobPhase: i * 0.85
      });
    }

    const w = {
      scene,
      skyDome,
      baseFogDensity,
      starPoints,
      slabA,
      slabB,
      slabLen,
      lampPoleMesh,
      lampBulbMesh,
      lamps,
      lampSpan: 12 * lampSpacing,
      cabinGroup,
      needleTach,
      needleSpeed,
      wheelGroup,
      amuletPivot,
      headBeamL,
      headBeamR,
      fftBars,
      ledCanvas,
      ledCtx,
      ledTexture,
      mirrorLightL,
      mirrorLightR,
      wingMirrorLight,
      roadObjects,
      roadMat,
      groundMatLeft,
      groundMatRight,
      mountLeft,
      mountRight,
      sunGroup,
      moonGroup,
      birdsMesh,
      flock,
      airplaneGroup,
      planeStrobe,
      planeBeacon,
      titanGroup,
      titanCore,
      titanGlowMat,
      armL,
      armR,
      legL,
      legR,
      titanHead,
      titanState: 'hidden',
      titanTimer: 16.0,
      titanSide: 1,
      titanZ: -205,
      titanY: -95,
      oceanGroup,
      oceanMesh,
      foamStrips,
      sailboats,
      lhBeam,
      volcanoGroup,
      lavaRiverL,
      lavaRiverR,
      lavaParticles,
      lavaVels,
      synthwaveGroup,
      desertGroup,
      biomes,
      applyBiomePalette,
      cycleBiome,
      currentBiomeIndex: 0,
      biomeTimer: 0.0,
      distanceDriven: 0.0,
      lastSpawnDistance: 0.0
    };

    applyBiomePalette(0, this.isDay);

    // Pre-seed 10 roadside objects matched to initial biome (Costa Tropical)
    for (let s = 0; s < 10; s++) {
      this._activateRoadSlot(w, -20 - s * 18);
    }

    return w;
  }

  _activateRoadSlot(w, initialZ = -175) {
    if (!w || !w.roadObjects) return false;
    const bIdx = w.currentBiomeIndex || 0;
    const allowedKinds = bIdx === 0 ? [0, 1] : (bIdx === 1 ? [2, 3] : (bIdx === 2 ? [4, 5] : [6, 7]));
    const targetKind = allowedKinds[Math.floor(Math.random() * allowedKinds.length)];
    let slot = w.roadObjects.find(o => !o.active && o.kindIdx === targetKind);
    if (!slot) slot = w.roadObjects.find(o => !o.active);
    if (!slot) {
      slot = w.roadObjects.reduce((a, b) => (a.z > b.z ? a : b));
    }
    slot.active = true;
    // In Costa Tropical (bIdx === 0), palms & beach umbrellas stay on the golden beach left side (side = -1)
    slot.side = (bIdx === 0 && (slot.kindIdx === 0 || slot.kindIdx === 1)) ? -1 : (Math.random() > 0.5 ? 1 : -1);
    slot.distFromRoad = 15.0 + Math.random() * 34.0;
    slot.z = initialZ;

    const curCurve = Math.sin(slot.z * 0.012 + this.time * 0.6) * 8.0;
    slot.x = curCurve + slot.side * slot.distFromRoad;
    slot.mesh.position.set(slot.x, 0, slot.z);
    slot.mesh.rotation.y = slot.side * 0.2;
    slot.mesh.visible = true;
    return true;
  }

  spawnRoadObject(force = false) {
    const w = this.worlds && this.worlds[1];
    if (!w) return false;
    if (!force && (this.time - this.lastRoadSpawnTime) < 0.32) return false;
    this.lastRoadSpawnTime = this.time;
    return this._activateRoadSlot(w, -172);
  }

  _updateCyberWorld(w, dt, audio, P, audioEnergy) {
    this._updateWorldAtmosphere(w, audio, dt);

    // Dynamic Road Curve calculation helper
    const getRoadCurve = (z, t = this.time) => Math.sin(z * 0.012 + t * 0.6) * 8.0;

    // 1. Anchor interior cabin directly to camera POV with road curve sway
    const camCurve = getRoadCurve(0);
    if (this.camera) {
      this.camera.position.x = camCurve * 0.25 + this.steerInput * 4.2;
      w.cabinGroup.position.copy(this.camera.position);
      w.cabinGroup.quaternion.copy(this.camera.quaternion);
    }

    // Steering wheel rotates smoothly with A/D & mouse steering
    const targetWheelRot = -this.steerInput * 1.1;
    w.wheelGroup.rotation.z += (targetWheelRot - w.wheelGroup.rotation.z) * Math.min(1, dt * 11);

    // Glowing gauges: Tachometer needle rises with bass & bio-pulse, Speedometer rises with speed
    const tachTarget = 2.05 - Math.min(1.0, audio.bass * 1.25 + (this.bioPulse || 0) * 0.8 + 0.12) * 3.8;
    const speedTarget = 2.05 - Math.min(1.0, P.speed * 0.85 + audioEnergy * 0.45 + 0.18) * 3.8;
    w.needleTach.rotation.z += (tachTarget - w.needleTach.rotation.z) * Math.min(1, dt * 14);
    w.needleSpeed.rotation.z += (speedTarget - w.needleSpeed.rotation.z) * Math.min(1, dt * 9);

    // Central Radio Screen: 16 FFT Equalizer Bars reactive to spectrum16 (40Hz - 12kHz)
    if (w.fftBars) {
      const spec = Array.isArray(audio.spectrum16) ? audio.spectrum16 : null;
      for (let b = 0; b < w.fftBars.length; b++) {
        const bar = w.fftBars[b];
        let freqWeight;
        if (spec && spec.length > 0) {
          const specIdx = Math.min(spec.length - 1, Math.floor((b / w.fftBars.length) * spec.length));
          freqWeight = Number(spec[specIdx]) || 0;
        } else {
          freqWeight = b < 5 ? audio.bass : (b < 11 ? audio.mid : audio.treble);
        }
        const bioBoost = (this.bioPulse || 0) * 0.4;
        const targetH = Math.max(0.08, Math.min(1.0, freqWeight + bioBoost));
        bar.scale.y += (targetH - bar.scale.y) * Math.min(1, dt * 22);
      }
    }

    // Digital LED Counter (KM / BPM + Biome Name) on dashboard canvas
    if (w.ledCtx && w.ledTexture) {
      const distInt = Math.floor(w.distanceDriven || 0);
      const bpm = Math.round(124 + audio.bass * 32);
      const bIdx = w.currentBiomeIndex || 0;
      const biomeLabel = (w.biomes && w.biomes[bIdx]) ? w.biomes[bIdx] : 'COSTA TROPICAL';
      if (w.lastLedDist !== distInt || w.lastLedBiome !== bIdx) {
        w.lastLedDist = distInt;
        w.lastLedBiome = bIdx;
        const ctx = w.ledCtx;
        ctx.clearRect(0, 0, 256, 84);
        ctx.fillStyle = 'rgba(2, 8, 16, 0.92)';
        ctx.fillRect(0, 0, 256, 84);
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, 252, 80);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`${distInt} KM · ${bpm} BPM`, 12, 30);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(`BIOMA: ${biomeLabel}`, 12, 62);
        w.ledTexture.needsUpdate = true;
      }
    }

    // Rearview mirror taillight flashes & lateral wing mirror flash
    const mirrorDrift = Math.sin(this.time * 0.8) * 0.02;
    if (w.mirrorLightL) w.mirrorLightL.position.x = -0.06 + mirrorDrift;
    if (w.mirrorLightR) w.mirrorLightR.position.x = 0.06 + mirrorDrift;

    // Rearview mirror sacred geometric amulet swings with steering inertia & beat
    w.amuletPivot.rotation.z = Math.sin(this.time * 3.2) * (0.14 + audio.mid * 0.45) - this.steerInput * 0.38;
    w.amuletPivot.rotation.x = Math.cos(this.time * 2.4) * (0.08 + audio.bass * 0.3);

    // Biome-aware Day/Night sky & fog palette (preserves active biome identity)
    const isDay = this.isDay;
    if (typeof w.applyBiomePalette === 'function') {
      w.applyBiomePalette(w.currentBiomeIndex || 0, isDay);
    }
    if (w.starPoints) w.starPoints.visible = !isDay;
    if (w.sunGroup) w.sunGroup.visible = isDay;
    if (w.moonGroup) w.moonGroup.visible = !isDay;
    if (w.mountLeft) w.mountLeft.material.color.setHex(isDay ? 0x334155 : 0x090e1a);
    if (w.mountRight) w.mountRight.material.color.setHex(isDay ? 0x334155 : 0x090e1a);

    const beamOp = isDay ? 0.015 : (0.13 + audio.bass * 0.12);
    w.headBeamL.material.opacity = beamOp;
    w.headBeamR.material.opacity = beamOp;

    // Daytime birds crossing in V-formation
    if (isDay && w.birdsMesh && w.flock) {
      w.birdsMesh.visible = true;
      w.flock.x += dt * w.flock.speedX;
      w.flock.z += dt * w.flock.speedZ;
      if (w.flock.x > 140) {
        w.flock.x = -130;
        w.flock.y = 65 + Math.random() * 25;
        w.flock.z = -200 - Math.random() * 60;
      }
      const wingFlap = Math.sin(this.time * 9.0) * 0.14;
      for (let b = 0; b < 9; b++) {
        const side = b === 0 ? 0 : (b % 2 === 1 ? -1 : 1);
        const rank = Math.ceil(b / 2);
        const bx = w.flock.x + side * rank * 4.2;
        const by = w.flock.y + Math.abs(side) * wingFlap;
        const bz = w.flock.z - rank * 3.8;
        this._dummy.position.set(bx, by, bz);
        this._dummy.rotation.set(0, Math.atan2(w.flock.speedX, w.flock.speedZ), 0);
        this._dummy.scale.set(1.4, 0.4, 1.4);
        this._dummy.updateMatrix();
        w.birdsMesh.setMatrixAt(b, this._dummy.matrix);
      }
      w.birdsMesh.instanceMatrix.needsUpdate = true;
    } else if (w.birdsMesh) {
      w.birdsMesh.visible = false;
    }

    // Nighttime airplane crossing slowly at high altitude
    if (!isDay && w.airplaneGroup) {
      w.airplaneGroup.visible = true;
      w.airplaneGroup.position.x += dt * 7.5;
      if (w.airplaneGroup.position.x > 190) {
        w.airplaneGroup.position.x = -190;
        w.airplaneGroup.position.y = 105 + Math.random() * 25;
      }
      if (w.planeStrobe) w.planeStrobe.visible = (this.time * 5.0) % 1.0 < 0.25;
      if (w.planeBeacon) w.planeBeacon.visible = (this.time * 2.5) % 1.0 < 0.5;
    } else if (w.airplaneGroup) {
      w.airplaneGroup.visible = false;
    }

    // 2. Surprise Emergence of the 95m Titan / Colossus (every ~25s or bass > 0.85)
    if (w.titanGroup) {
      w.titanTimer = (w.titanTimer || 0) + dt;
      if (w.titanState === 'hidden') {
        w.titanGroup.visible = false;
        if (w.titanTimer >= 25.0 || (audio.rawBass > 0.85 && w.titanTimer >= 8.0)) {
          w.titanState = 'emerging';
          w.titanTimer = 0;
          w.titanSide = Math.random() > 0.5 ? 1 : -1;
          w.titanZ = -205;
          w.titanY = -95;
          w.titanGroup.visible = true;
        }
      } else if (w.titanState === 'emerging') {
        const tFrac = Math.min(1.0, w.titanTimer / 3.0);
        const eased = 1.0 - Math.pow(1.0 - tFrac, 3);
        w.titanY = -95 + eased * 95;
        if (w.titanTimer >= 3.0) {
          w.titanState = 'active';
          w.titanTimer = 0;
          w.titanY = 0;
        }
      } else if (w.titanState === 'active') {
        w.titanZ += (18 + P.speed * 20) * dt;
        const stride = Math.sin(this.time * 2.4);
        if (w.legL) w.legL.rotation.x = stride * 0.28;
        if (w.legR) w.legR.rotation.x = -stride * 0.28;
        if (w.armL) w.armL.rotation.x = -stride * 0.35;
        if (w.armR) w.armR.rotation.x = stride * 0.35;
        if (w.titanHead) w.titanHead.rotation.y = Math.sin(this.time * 0.9) * 0.25;
        if (w.titanZ > 24 || w.titanTimer > 11.0) {
          w.titanState = 'fading';
          w.titanTimer = 0;
        }
      } else if (w.titanState === 'fading') {
        const fFrac = Math.min(1.0, w.titanTimer / 2.2);
        w.titanY = -fFrac * 95;
        w.titanZ += 16 * dt;
        if (w.titanTimer >= 2.2) {
          w.titanState = 'hidden';
          w.titanTimer = 0;
          w.titanGroup.visible = false;
        }
      }

      if (w.titanGroup.visible) {
        const titanCurve = getRoadCurve(w.titanZ);
        w.titanGroup.position.set(titanCurve + (w.titanSide || 1) * 45, w.titanY || 0, w.titanZ);
        w.titanGroup.rotation.y = -(w.titanSide || 1) * 0.22;
        if (w.titanCore) {
          const coreScale = 1.0 + audio.bass * 0.95 + (this.bioPulse || 0) * 0.7;
          w.titanCore.scale.setScalar(coreScale);
          if (w.titanGlowMat) {
            const hue = (0.5 + audio.bass * 0.16) % 1.0;
            w.titanGlowMat.color.setHSL(hue, 1.0, 0.6 + audio.bass * 0.3);
          }
        }
      }
    }

    // 3. Infinite Curved Road treadmill deformation & progression
    const isRain = (this.weatherMode === 'rain' || this.weatherMode === 'thunderstorm');
    if (w.roadMat) {
      w.roadMat.roughness = isRain ? 0.12 : 0.75;
      w.roadMat.metalness = isRain ? 0.70 : 0.25;
    }
    if (w.slabA && w.slabB) {
      [w.slabA, w.slabB].forEach(sl => {
        sl.traverse(ch => {
          if (ch.name === 'roadPuddle') ch.visible = isRain;
        });
      });
    }

    const roadSpeed = (34 + P.speed * 58 + audio.bass * 24 + (this.bioPulse || 0) * 16) * dt;
    w.slabA.position.z += roadSpeed;
    w.slabB.position.z += roadSpeed;
    if (w.slabA.position.z >= w.slabLen) w.slabA.position.z -= w.slabLen * 2;
    if (w.slabB.position.z >= w.slabLen) w.slabB.position.z -= w.slabLen * 2;

    // Apply smooth sine wave curvature to highway & flanking terrain vertices along Z
    const updateSlabCurve = (slab) => {
      if (!slab) return;
      [slab.terrainLeftMesh, slab.terrainRightMesh, slab.asphaltMesh, slab.edgeL, slab.edgeR].forEach(mesh => {
        if (mesh && mesh.geometry.userData && mesh.geometry.userData.origX) {
          const p = mesh.geometry.attributes.position;
          const ox = mesh.geometry.userData.origX;
          const oz = mesh.geometry.userData.origZ;
          for (let i = 0; i < ox.length; i++) {
            p.setX(i, ox[i] + getRoadCurve(oz[i] + slab.position.z));
          }
          p.needsUpdate = true;
        }
      });
      if (slab.dashes) {
        for (let i = 0; i < slab.dashes.length; i++) {
          const d = slab.dashes[i];
          d.mesh.position.x = getRoadCurve(d.localZ + slab.position.z);
        }
      }
      if (slab.puddles) {
        for (let i = 0; i < slab.puddles.length; i++) {
          const pud = slab.puddles[i];
          pud.mesh.position.x = pud.localX + getRoadCurve(pud.localZ + slab.position.z);
        }
      }
    };
    updateSlabCurve(w.slabA);
    updateSlabCurve(w.slabB);

    // Continuous spawn every 15 meters of progress
    w.distanceDriven = (w.distanceDriven || 0) + roadSpeed;
    if (w.distanceDriven - (w.lastSpawnDistance || 0) >= 15.0) {
      w.lastSpawnDistance = w.distanceDriven;
      this.spawnRoadObject(true);
    }

    // Automatic Biome Transition every 20 seconds
    w.biomeTimer = (w.biomeTimer || 0) + dt;
    if (w.biomeTimer >= 20.0) {
      w.cycleBiome();
      w.biomeTimer = 0.0;
    }

    // Biome Scenery Animations:
    // Biome 0: Tropical ocean waves + animated white shoreline foam + rocking sailboats
    if (w.oceanGroup && w.oceanGroup.visible) {
      if (w.oceanMesh && w.oceanMesh.geometry.userData && w.oceanMesh.geometry.userData.origY) {
        const pos = w.oceanMesh.geometry.attributes.position;
        const origY = w.oceanMesh.geometry.userData.origY;
        for (let i = 0; i < origY.length; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          pos.setY(i, origY[i] + Math.sin(vx * 0.14 + this.time * 2.4) * 0.45 + Math.cos(vz * 0.10 + this.time * 1.9) * 0.35);
        }
        pos.needsUpdate = true;
      }
      if (w.foamStrips) {
        for (let f = 0; f < w.foamStrips.length; f++) {
          const fs = w.foamStrips[f];
          const wave = Math.sin(this.time * 2.2 + fs.phase);
          fs.mesh.position.x = fs.baseX + wave * 2.2;
          fs.mesh.material.opacity = 0.35 + (wave * 0.5 + 0.5) * 0.5;
        }
      }
      if (w.lhBeam) w.lhBeam.rotation.y += dt * 1.6;
      if (w.sailboats) {
        for (let sb = 0; sb < w.sailboats.length; sb++) {
          w.sailboats[sb].rotation.z = Math.sin(this.time * 2.0 + sb) * 0.09;
        }
      }
    }

    // Biome 1: Volcanic lava rivers pulsing + 4 volcanoes erupting with bass
    if (w.volcanoGroup && w.volcanoGroup.visible) {
      const lavaPulse = 0.8 + audio.bass * 0.5 + Math.sin(this.time * 3.5) * 0.15;
      if (w.lavaRiverL) w.lavaRiverL.material.color.setRGB(1.0 * lavaPulse, 0.32 * lavaPulse, 0.02);
      if (w.lavaParticles) {
        const pos = w.lavaParticles.geometry.attributes.position.array;
        const vels = w.lavaVels;
        const bassBurst = audio.bass > 0.35 ? (1.0 + audio.bass * 2.6) : 1.0;
        const bioBoost = 1.0 + (this.bioPulse || 0) * 1.6;
        for (let p = 0; p < vels.length; p++) {
          const v = vels[p];
          pos[p * 3] += v.vx * dt;
          pos[p * 3 + 1] += v.vy * dt * bassBurst * bioBoost;
          pos[p * 3 + 2] += v.vz * dt;
          if (pos[p * 3 + 1] > v.baseY + 52) {
            pos[p * 3] = v.source.group.position.x + (Math.random() - 0.5) * 10;
            pos[p * 3 + 1] = v.baseY;
            pos[p * 3 + 2] = v.source.group.position.z + (Math.random() - 0.5) * 10;
          }
        }
        w.lavaParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // 4. Roadside streetlights rushing past (curved along with highway)
    for (let i = 0; i < w.lamps.length; i++) {
      const lp = w.lamps[i];
      lp.z += roadSpeed;
      if (lp.z > 28) lp.z -= w.lampSpan;

      const lampCurve = getRoadCurve(lp.z);
      const lx = lampCurve + lp.side * 11.2;

      this._dummy.position.set(lx, 0, lp.z);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      w.lampPoleMesh.setMatrixAt(i, this._dummy.matrix);

      this._dummy.position.set(lx - lp.side * 0.9, 7.3, lp.z);
      this._dummy.scale.setScalar(1.0 + audio.treble * 0.45);
      this._dummy.updateMatrix();
      w.lampBulbMesh.setMatrixAt(i, this._dummy.matrix);
    }
    w.lampPoleMesh.instanceMatrix.needsUpdate = true;
    w.lampBulbMesh.instanceMatrix.needsUpdate = true;

    // 5. Strong bass kicks spawn extra surprise roadside object
    if (audio.rawBass > 0.46) {
      this.spawnRoadObject(false);
    }

    // 6. Update Active Roadside Objects (Strict Zero-Invasion: |x - curCurve| >= 16)
    for (let i = 0; i < w.roadObjects.length; i++) {
      const obj = w.roadObjects[i];
      if (!obj.active) continue;
      obj.z += roadSpeed;

      const curCurve = getRoadCurve(obj.z);
      // STRICT ZERO-INVASION: obj.mesh.position.x is mathematically guaranteed to stay >= 16 units away from asphalt center
      obj.mesh.position.x = curCurve + obj.side * obj.distFromRoad;
      obj.mesh.position.z = obj.z;

      if (obj.kindIdx >= 8) {
        // Holograms & floating crystals levitate and spin smoothly
        obj.mesh.position.y = Math.sin(this.time * 2.5 + obj.bobPhase) * 0.65;
        obj.mesh.rotation.y += dt * (1.2 + audio.mid * 1.5);
      }
      if (obj.z > 24) {
        obj.active = false;
        obj.mesh.visible = false;
      }
    }
  }

  // ============================================================================
  // WORLD 2: 🌿 BIO-TERRA 3D (`mycelium`)
  // - Infinite planetary flying ecosystem: floating islands, luminous waterfall particle
  //   cascades, reactive fractal flora opening geometric petals with audio & bio-signals,
  //   and buzzing bioluminescent light creatures pollinating the trees.
  // ============================================================================
  _buildMyceliumWorld() {
    const scene = new THREE.Scene();
    const baseFogDensity = 0.0035;
    scene.fog = new THREE.FogExp2(0x021b14, baseFogDensity);

    const skyDome = this._createSkyDome({
      top: 0x052e24,
      horizon: 0x047857,
      bottom: 0x01130e,
      accent: 0x34d399
    });
    scene.add(skyDome);

    // Lush planetary lighting
    const hemi = new THREE.HemisphereLight(0xa7f3d0, 0x064e3b, 1.25);
    scene.add(hemi);
    const sunLight = new THREE.DirectionalLight(0x6ee7b7, 1.2);
    sunLight.position.set(35, 60, 40);
    scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    rimLight.position.set(-40, -15, -30);
    scene.add(rimLight);

    // 1. Floating Islands (12 islands arranged in 3D planetary airspace)
    const islandGroup = new THREE.Group();
    const islands = [];
    const islandCount = 12;

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x1c2826,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });
    const turfMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      emissive: 0x047857,
      emissiveIntensity: 0.45,
      roughness: 0.75
    });
    const crystalMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.75
    });

    const flowerPetalMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.2
    });
    const flowerCoreMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const petals = [];
    const waterfallEmitters = [];

    for (let i = 0; i < islandCount; i++) {
      const g = new THREE.Group();
      const angle = (i / islandCount) * Math.PI * 2;
      const radius = 28 + (i % 3) * 18;
      const x = Math.cos(angle) * radius;
      const y = -12 + (i * 4.5) % 28 + Math.sin(i * 1.5) * 4;
      const z = Math.sin(angle) * radius;
      const scale = 0.85 + (i % 4) * 0.25;

      // Rocky underside (inverted cone)
      const rockGeo = new THREE.ConeGeometry(9.0 * scale, 12.0 * scale, 7, 1, true);
      rockGeo.rotateX(Math.PI);
      const rockMesh = new THREE.Mesh(rockGeo, rockMat);
      rockMesh.position.y = -6.0 * scale;
      g.add(rockMesh);

      // Lush turf cap
      const turfGeo = new THREE.CylinderGeometry(9.2 * scale, 8.8 * scale, 1.4 * scale, 8);
      const turfMesh = new THREE.Mesh(turfGeo, turfMat);
      turfMesh.position.y = 0.7 * scale;
      g.add(turfMesh);

      // Hanging crystal roots beneath island
      for (let cr = 0; cr < 3; cr++) {
        const root = new THREE.Mesh(
          new THREE.ConeGeometry(0.7 * scale, 5.5 * scale, 4),
          crystalMat
        );
        root.rotateX(Math.PI);
        root.position.set((cr - 1) * 2.2 * scale, -9.0 * scale - cr * 1.2, (cr % 2) * 1.8 * scale);
        g.add(root);
      }

      // Fractal Flora: Geometric Tree / Blossoming Flower on island surface
      const flowerCore = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.2 * scale, 0),
        flowerCoreMat
      );
      flowerCore.position.y = 3.6 * scale;
      g.add(flowerCore);

      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, 3.2 * scale, 6),
        turfMat
      );
      stalk.position.y = 1.6 * scale;
      g.add(stalk);

      // 8 Geometric petals that unfurl and bloom with audio/bio-signal
      const petalGeo = new THREE.OctahedronGeometry(1.4 * scale, 0);
      petalGeo.scale(0.5, 1.8, 0.25);
      petalGeo.translate(0, 1.2 * scale, 0);

      for (let p = 0; p < 8; p++) {
        const pMesh = new THREE.Mesh(petalGeo, flowerPetalMat);
        const pPivot = new THREE.Group();
        pPivot.position.y = 3.6 * scale;
        pPivot.rotation.y = (p / 8) * Math.PI * 2;
        pPivot.add(pMesh);
        g.add(pPivot);
        petals.push({ pivot: pPivot, mesh: pMesh, baseAngle: 0.35 });
      }

      g.position.set(x, y, z);
      islandGroup.add(g);
      islands.push({ group: g, baseX: x, baseY: y, baseZ: z, phase: i * 0.8 });

      // 6 islands emit cascading luminous waterfalls
      if (i % 2 === 0) {
        waterfallEmitters.push({
          x: x + 6.5 * scale,
          y: y + 0.5 * scale,
          z: z,
          scale
        });
      }
    }
    scene.add(islandGroup);

    // 2. Cascadas de Partículas de Agua Luminosa (1,400 particles)
    const waterfallCount = 1400;
    const wfPositions = new Float32Array(waterfallCount * 3);
    const wfVels = [];
    for (let p = 0; p < waterfallCount; p++) {
      const emitter = waterfallEmitters[p % waterfallEmitters.length];
      const px = emitter.x + (Math.random() - 0.5) * 3.5;
      const py = emitter.y - Math.random() * 32;
      const pz = emitter.z + (Math.random() - 0.5) * 3.5;
      wfPositions[p * 3] = px;
      wfPositions[p * 3 + 1] = py;
      wfPositions[p * 3 + 2] = pz;
      wfVels.push({
        vx: (Math.random() - 0.5) * 0.8,
        vy: -12 - Math.random() * 16,
        vz: (Math.random() - 0.5) * 0.8,
        emitter
      });
    }
    const wfGeo = new THREE.BufferGeometry();
    wfGeo.setAttribute('position', new THREE.BufferAttribute(wfPositions, 3));
    const wfMat = new THREE.PointsMaterial({
      size: 2.2,
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const waterfallParticles = new THREE.Points(wfGeo, wfMat);
    scene.add(waterfallParticles);

    // 3. Criaturas de Luz / Polinizadores (36 bioluminescent flying fairy orbs)
    const creatureCount = 36;
    const creatureGeo = new THREE.SphereGeometry(0.45, 8, 8);
    const creatureMat = new THREE.MeshBasicMaterial({ color: 0xa7f3d0 });
    const creatureMesh = new THREE.InstancedMesh(creatureGeo, creatureMat, creatureCount);
    creatureMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(creatureMesh);

    const creatures = [];
    for (let c = 0; c < creatureCount; c++) {
      creatures.push({
        islandIdx: c % islandCount,
        orbitRadius: 7.0 + (c % 4) * 4.0,
        speed: 1.2 + Math.random() * 1.5,
        phase: c * 0.7,
        bobPhase: Math.random() * Math.PI * 2
      });
    }

    return {
      scene,
      skyDome,
      baseFogDensity,
      islandGroup,
      islands,
      petals,
      waterfallParticles,
      wfPositions,
      wfVels,
      creatureMesh,
      creatures
    };
  }

  _updateMyceliumWorld(w, dt, audio, P, audioEnergy) {
    this._updateWorldAtmosphere(w, audio, dt);

    // Biological input modulation
    const bioSignal = (this.bioValue || 0);
    const bloomScale = 1.0 + audio.bass * 0.75 + bioSignal * 1.45;

    // 1. Gently float islands
    for (let i = 0; i < w.islands.length; i++) {
      const isl = w.islands[i];
      isl.group.position.y = isl.baseY + Math.sin(this.time * 1.4 + isl.phase) * 1.8;
      isl.group.rotation.y = Math.sin(this.time * 0.3 + isl.phase) * 0.08;
    }

    // 2. Animate Fractal Flora: open geometric petals with audio & bio-signal
    for (let p = 0; p < w.petals.length; p++) {
      const pt = w.petals[p];
      // Petals rotate outward from center like a blooming lotus
      const targetPitch = pt.baseAngle + bloomScale * 0.42;
      pt.pivot.rotation.x = targetPitch;
      pt.mesh.scale.set(1.0 + audio.treble * 0.4, bloomScale, 1.0 + audio.mid * 0.3);
    }

    // 3. Animate Cascading Luminous Waterfall Particles
    const pos = w.wfPositions;
    const vels = w.wfVels;
    const count = vels.length;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const v = vels[i];
      if (!v || !v.emitter) continue;
      pos[i3] += v.vx * dt;
      pos[i3 + 1] += v.vy * dt * (1.0 + audio.bass * 0.4);
      pos[i3 + 2] += v.vz * dt;

      // Reset when particle falls far below island
      if (pos[i3 + 1] < v.emitter.y - 38) {
        pos[i3] = v.emitter.x + (Math.random() - 0.5) * 3.5;
        pos[i3 + 1] = v.emitter.y;
        pos[i3 + 2] = v.emitter.z + (Math.random() - 0.5) * 3.5;
      }
    }
    w.waterfallParticles.geometry.attributes.position.needsUpdate = true;

    // 4. Animate Bioluminescent Light Creatures (Pollinators)
    const creatureSpeedMod = 1.0 + audio.treble * 0.8 + bioSignal * 0.9;
    for (let c = 0; c < w.creatures.length; c++) {
      const cr = w.creatures[c];
      const isl = w.islands[cr.islandIdx];
      const ang = this.time * cr.speed * creatureSpeedMod + cr.phase;
      const cx = isl.group.position.x + Math.cos(ang) * cr.orbitRadius;
      const cy = isl.group.position.y + 4.5 + Math.sin(this.time * 3.2 + cr.bobPhase) * 2.2;
      const cz = isl.group.position.z + Math.sin(ang) * cr.orbitRadius;

      this._dummy.position.set(cx, cy, cz);
      const pulse = 1.0 + Math.sin(this.time * 8.0 + cr.phase) * 0.35 + bioSignal * 0.5;
      this._dummy.scale.setScalar(pulse);
      this._dummy.updateMatrix();
      w.creatureMesh.setMatrixAt(c, this._dummy.matrix);
    }
    w.creatureMesh.instanceMatrix.needsUpdate = true;

    // 5. Hypnotic flight navigation through the island archipelago
    if (this.autoFlight) {
      const flightSpeed = (0.22 + P.speed * 0.4) * dt;
      this.flightPhase += flightSpeed;
      const flightRad = 45;
      this.camera.position.x = Math.cos(this.flightPhase * 0.6) * flightRad;
      this.camera.position.y = 8 + Math.sin(this.flightPhase * 0.9) * 12;
      this.camera.position.z = Math.sin(this.flightPhase * 0.6) * flightRad;
      this.camera.lookAt(0, 5, 0);
    }
  }

  // ============================================================================
  // WORLD 3: 🏛️ CATEDRAL / LIDAR 3D (`cathedral`)
  // - 45,000 volumetric LiDAR points with a STOCHASTIC DIRECTOR mutating
  //   the architecture every 16 beats without repeating patterns:
  //   1. Gothic Cathedral Vaults (laser-scanned pointed arches, rose window, pillars)
  //   2. Infinite Mirror Labyrinth (orthogonal laser grid corridors, reflective walls)
  //   3. Astronomical Clock Planetary Rings (concentric 3D gyro rings, rotating gear tracks)
  //   4. Self-Assembling Fractal Monoliths (floating geometric blocks dispersing & assembling)
  // ============================================================================
  _buildCathedralWorld() {
    const scene = new THREE.Scene();
    const baseFogDensity = 0.0048;
    scene.fog = new THREE.FogExp2(0x030712, baseFogDensity);

    const skyDome = this._createSkyDome({
      top: 0x020617,
      horizon: 0x0c1a30,
      bottom: 0x01030a,
      accent: 0x00f0ff
    });
    scene.add(skyDome);

    const pointCount = 45000;
    const positions = new Float32Array(pointCount * 3);
    const mode0 = new Float32Array(pointCount * 3);
    const mode1 = new Float32Array(pointCount * 3);
    const mode2 = new Float32Array(pointCount * 3);
    const mode3 = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    const baseColors = new Float32Array(pointCount * 3);

    // Helper for Potree LiDAR height/reflectance gradient: blue -> cyan -> green -> yellow -> magenta
    const sampleLidarColor = (tNorm, jitter, outColor) => {
      const t = Math.max(0, Math.min(1, tNorm + jitter));
      if (t < 0.25) {
        outColor.setRGB(0.05, 0.25 + (t / 0.25) * 0.75, 1.0); // blue -> cyan
      } else if (t < 0.5) {
        const u = (t - 0.25) / 0.25;
        outColor.setRGB(0.05, 1.0, 1.0 - u * 0.75); // cyan -> green
      } else if (t < 0.78) {
        const u = (t - 0.5) / 0.28;
        outColor.setRGB(0.1 + u * 0.9, 1.0, 0.15); // green -> yellow
      } else {
        const u = (t - 0.78) / 0.22;
        outColor.setRGB(1.0, 1.0 - u * 0.75, u * 0.95); // yellow -> magenta
      }
    };

    let idx = 0;
    const pushPoint = (x, y, z, colorT) => {
      if (idx >= pointCount) return;
      const i3 = idx * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      mode0[i3] = x;
      mode0[i3 + 1] = y;
      mode0[i3 + 2] = z;

      sampleLidarColor(colorT, (Math.random() - 0.5) * 0.06, this._colorA);
      colors[i3] = this._colorA.r;
      colors[i3 + 1] = this._colorA.g;
      colors[i3 + 2] = this._colorA.b;
      baseColors[i3] = this._colorA.r;
      baseColors[i3 + 1] = this._colorA.g;
      baseColors[i3 + 2] = this._colorA.b;
      idx++;
    };

    // 1. Gothic Cathedral Pillars & Pointed Ribbed Arches (18,000 pts)
    const archRows = 12;
    for (let r = 0; r < archRows; r++) {
      const z = 34 - r * 7.5;
      for (let side = -1; side <= 1; side += 2) {
        const px = side * 12.5;
        for (let k = 0; k < 280; k++) {
          const y = Math.random() * 19.0;
          const a = Math.random() * Math.PI * 2;
          const rad = 0.85 + Math.sin(a * 8) * 0.12;
          pushPoint(px + Math.cos(a) * rad, y, z + Math.sin(a) * rad, y / 28.0);
        }
      }
      for (let k = 0; k < 460; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const u = Math.random();
        const x = side * 12.5 * (1.0 - Math.pow(u, 1.35));
        const y = 18.5 + Math.sin(u * Math.PI * 0.5) * 11.5;
        pushPoint(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.4, z + (Math.random() - 0.5) * 0.7, y / 31.0);
      }
    }

    // 2. Rose Window Mandala & Sanctuary Spire at Far End (4,500 pts)
    const altarZ = -56;
    for (let k = 0; k < 2600; k++) {
      const ring = (k % 5) + 1;
      const rad = ring * 2.1 + (Math.random() - 0.5) * 0.25;
      const ang = (k / 2600) * Math.PI * 24 + Math.sin(ring) * 0.2;
      const x = Math.cos(ang) * rad;
      const y = 17.5 + Math.sin(ang) * rad;
      pushPoint(x, y, altarZ + (Math.random() - 0.5) * 0.6, 0.55 + (rad / 11.0) * 0.45);
    }
    for (let k = 0; k < 1900; k++) {
      const h = Math.random() * 38;
      const taper = Math.max(0.2, (38 - h) * 0.12);
      const a = Math.random() * Math.PI * 2;
      pushPoint(Math.cos(a) * taper, h, altarZ - 8 + Math.sin(a) * taper, h / 38.0);
    }

    // 3. 6 Scanned Sentinel Statues along the Nave (4,500 pts)
    for (let s = 0; s < 6; s++) {
      const side = s % 2 === 0 ? -1 : 1;
      const sx = side * 7.8;
      const sz = 22 - Math.floor(s / 2) * 22;
      for (let k = 0; k < 750; k++) {
        const part = k % 3;
        if (part === 0) {
          pushPoint(sx + (Math.random() - 0.5) * 2.2, Math.random() * 3.0, sz + (Math.random() - 0.5) * 2.2, 0.28);
        } else if (part === 1) {
          const y = 3.0 + Math.random() * 4.5;
          const r = 0.6 + (1 - (y - 3.0) / 4.5) * 0.55;
          const a = Math.random() * Math.PI * 2;
          pushPoint(sx + Math.cos(a) * r, y, sz + Math.sin(a) * r, 0.45 + (y / 12.0));
        } else {
          const a = Math.random() * Math.PI * 2;
          const b = Math.random() * Math.PI;
          pushPoint(sx + Math.sin(b) * Math.cos(a) * 0.55, 8.2 + Math.cos(b) * 0.65, sz + Math.sin(b) * Math.sin(a) * 0.55, 0.82);
        }
      }
    }

    // 4. Scanned Trees flanking outside the Cathedral Colonnade (6,500 pts)
    const treeCount = 10;
    for (let t = 0; t < treeCount; t++) {
      const side = t % 2 === 0 ? -1 : 1;
      const tx = side * (22 + (t % 3) * 7.5);
      const tz = 30 - Math.floor(t / 2) * 19;
      for (let k = 0; k < 650; k++) {
        if (k < 180) {
          const y = Math.random() * 8.0;
          const a = Math.random() * Math.PI * 2;
          pushPoint(tx + Math.cos(a) * 0.55, y, tz + Math.sin(a) * 0.55, y / 22.0);
        } else {
          const phi = Math.random() * Math.PI * 2;
          const cosT = Math.random() * 2 - 1;
          const sinT = Math.sqrt(1 - cosT * cosT);
          const rad = 2.5 + Math.random() * 4.2;
          const cy = 11.5 + cosT * rad * 0.85;
          pushPoint(tx + sinT * Math.cos(phi) * rad, cy, tz + sinT * Math.sin(phi) * rad, 0.35 + (cy / 24.0) * 0.45);
        }
      }
    }

    // 5. Remaining points -> Topographic Contour Terrain & Plaza Grid (up to 45,000 pts)
    while (idx < pointCount) {
      const gx = (Math.random() - 0.5) * 120;
      const gz = 45 - Math.random() * 130;
      const edgeDist = Math.max(0, Math.abs(gx) - 16);
      const hill = edgeDist > 0 ? Math.sin(gx * 0.09) * Math.cos(gz * 0.08) * 3.5 + edgeDist * 0.16 : 0;
      pushPoint(gx, hill, gz, Math.min(0.65, 0.05 + hill / 16.0));
    }

    // --- MODE 1: Laberinto de Espejos Infinitos (Orthogonal laser corridors & reflection planes) ---
    for (let i = 0; i < pointCount; i++) {
      const i3 = i * 3;
      const planeIdx = i % 8;
      if (planeIdx < 4) {
        const wx = (planeIdx - 1.5) * 15.0;
        const wy = -6.0 + ((i * 1.3) % 36.0);
        const wz = 38.0 - ((i * 0.45) % 125.0);
        mode1[i3] = wx + (Math.sin(wy * 0.4) * 0.35);
        mode1[i3 + 1] = wy;
        mode1[i3 + 2] = wz;
      } else {
        const wz = 30.0 - (planeIdx - 4) * 32.0;
        const wx = -28.0 + ((i * 0.8) % 56.0);
        const wy = -6.0 + ((i * 1.1) % 36.0);
        mode1[i3] = wx;
        mode1[i3 + 1] = wy;
        mode1[i3 + 2] = wz + (Math.sin(wx * 0.4) * 0.35);
      }
    }

    // --- MODE 2: Anillos Planetarios tipo Reloj Astronómico (Concentric 3D gyro rings & gears) ---
    for (let i = 0; i < pointCount; i++) {
      const i3 = i * 3;
      const ringIdx = i % 7;
      const rad = 7.0 + ringIdx * 4.6 + Math.sin(i * 0.05) * 0.35;
      const ang = (i / 800) * Math.PI * 2;
      if (ringIdx === 0 || ringIdx === 3) {
        const tooth = (i % 24 < 12) ? 1.5 : 0;
        mode2[i3] = Math.cos(ang) * (rad + tooth);
        mode2[i3 + 1] = 16.0 + (Math.random() - 0.5) * 0.8;
        mode2[i3 + 2] = -22.0 + Math.sin(ang) * (rad + tooth);
      } else if (ringIdx === 1 || ringIdx === 4) {
        const rx = Math.cos(ang) * rad;
        const ry = Math.sin(ang) * rad;
        mode2[i3] = rx * 0.86 - ry * 0.5;
        mode2[i3 + 1] = 16.0 + rx * 0.5 + ry * 0.86;
        mode2[i3 + 2] = -22.0 + Math.sin(ang * 3.0) * 0.6;
      } else {
        mode2[i3] = (Math.random() - 0.5) * 1.0;
        mode2[i3 + 1] = 16.0 + Math.cos(ang) * rad;
        mode2[i3 + 2] = -22.0 + Math.sin(ang) * rad;
      }
    }

    // --- MODE 3: Monolitos Fractales Ensamblantes (4 massive sacred geometric towers) ---
    for (let i = 0; i < pointCount; i++) {
      const i3 = i * 3;
      const towerIdx = i % 4;
      const tx = (towerIdx % 2 === 0 ? -1 : 1) * 16.0;
      const tz = -36.0 + (towerIdx < 2 ? -18.0 : 18.0);
      const ty = -6.0 + (i % 650) * 0.065;
      const layer = Math.floor(ty / 5.0);
      const wTier = Math.max(1.5, 6.2 - layer * 0.6);
      mode3[i3] = tx + (Math.random() - 0.5) * wTier;
      mode3[i3 + 1] = ty;
      mode3[i3 + 2] = tz + (Math.random() - 0.5) * wTier;
    }

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const pointMat = new THREE.PointsMaterial({
      size: 0.48,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const lidarPoints = new THREE.Points(pointGeo, pointMat);
    lidarPoints.frustumCulled = false;
    scene.add(lidarPoints);

    // Live Laser Scan Plane & Ring sweeping from camera to horizon per BPM cycle
    const scanRingGeo = new THREE.RingGeometry(18, 22, 48);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const scanRingMesh = new THREE.Mesh(scanRingGeo, scanRingMat);
    scene.add(scanRingMesh);

    const scanLineGeo = new THREE.PlaneGeometry(110, 0.65);
    scanLineGeo.rotateX(-Math.PI / 2);
    const scanLineMesh = new THREE.Mesh(
      scanLineGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff00a0,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    scanLineMesh.position.y = 0.25;
    scene.add(scanLineMesh);

    // Central sacred geometry relic with stochastic morphology (Icosahedron, TorusKnot, Octahedron, Dodecahedron)
    const cathedralGeoms = [
      new THREE.IcosahedronGeometry(6.5, 0),
      new THREE.TorusKnotGeometry(4.6, 1.4, 64, 16, 2, 3),
      new THREE.OctahedronGeometry(6.6, 0),
      new THREE.DodecahedronGeometry(6.2, 0)
    ];
    const initialCathIdx = Math.floor(Math.random() * cathedralGeoms.length);

    const centralCoreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x003355,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.85,
      wireframe: false
    });
    const centralWireMat = new THREE.MeshBasicMaterial({
      color: 0xff00a0,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });

    const centralGroup = new THREE.Group();
    centralGroup.position.set(0, 16.5, -15);
    const centralCoreMesh = new THREE.Mesh(cathedralGeoms[initialCathIdx], centralCoreMat);
    const centralWireMesh = new THREE.Mesh(cathedralGeoms[initialCathIdx], centralWireMat);
    centralWireMesh.scale.setScalar(1.05);
    centralGroup.add(centralCoreMesh, centralWireMesh);
    scene.add(centralGroup);

    return {
      scene,
      skyDome,
      baseFogDensity,
      lidarPoints,
      pointCount,
      positions,
      modes: [mode0, mode1, mode2, mode3],
      currentMode: 0,
      targetMode: 0,
      morphProgress: 1.0,
      beatCounter: 0,
      lastBpmPhase: 0,
      colors,
      baseColors,
      scanRingMesh,
      scanLineMesh,
      centralGroup,
      centralCoreMesh,
      centralWireMesh,
      cathedralGeoms,
      currentGeomIdx: initialCathIdx
    };
  }

  _updateCathedralWorld(w, dt, audio, P, audioEnergy, bpmPhase) {
    this._updateWorldAtmosphere(w, audio, dt);

    // Director Estocástico: Track beats to mutate architecture every 16 beats without repeating patterns
    if (bpmPhase < w.lastBpmPhase - 0.45) {
      w.beatCounter = (w.beatCounter || 0) + 1;
      if (w.beatCounter >= 16) {
        w.beatCounter = 0;
        const nextMode = (w.currentMode + 1 + Math.floor(Math.random() * 3)) % 4;
        w.targetMode = nextMode;
        w.morphProgress = 0.0;
      }
    }
    w.lastBpmPhase = bpmPhase;

    // Smooth architectural morph progress (lerp between active mode and target mode)
    if (w.currentMode !== w.targetMode) {
      w.morphProgress = Math.min(1.0, (w.morphProgress || 0) + dt * 1.35);
      if (w.morphProgress >= 1.0) {
        w.currentMode = w.targetMode;
      }
    }

    const currentPositions = w.modes[w.currentMode];
    const targetPositions = w.modes[w.targetMode];
    const morphT = w.morphProgress !== undefined ? w.morphProgress : 1.0;

    // Morph central sacred geometry live via ANGLE (CC 11)
    const rawAngle = (P && P.mirrorAngle !== undefined) ? Number(P.mirrorAngle) : this.morphAngle;
    const normAngle = rawAngle > 1.0 ? (rawAngle / 360.0) % 1.0 : Math.max(0, Math.min(1, rawAngle));
    const targetCathIdx = Math.min(w.cathedralGeoms.length - 1, Math.floor(normAngle * w.cathedralGeoms.length));
    if (targetCathIdx !== w.currentGeomIdx) {
      w.currentGeomIdx = targetCathIdx;
      w.centralCoreMesh.geometry = w.cathedralGeoms[targetCathIdx];
      w.centralWireMesh.geometry = w.cathedralGeoms[targetCathIdx];
    }
    w.centralGroup.rotation.y += dt * (0.6 + normAngle * 2.5);
    w.centralGroup.rotation.x = Math.sin(this.time * 1.5) * 0.35 + normAngle * Math.PI;
    w.centralGroup.rotation.z = Math.cos(this.time * 1.2) * 0.25;
    const coreScale = 1.0 + audio.bass * 0.45;
    w.centralGroup.scale.setScalar(coreScale);

    // Laser Scan Wave sweeps from near camera (z = 42) toward horizon (z = -85) on each BPM bar
    const sweepFrac = (bpmPhase * 0.5) % 1.0;
    const scanZ = 42 - sweepFrac * 127;
    const scanWidth = 9.5 + audio.treble * 8.0;
    const invScanWidth = 1.0 / scanWidth;

    w.scanRingMesh.position.set(0, 14, scanZ);
    w.scanRingMesh.scale.setScalar(1.0 + audio.bass * 0.25);
    w.scanLineMesh.position.z = scanZ;

    w.lidarPoints.material.size = 0.44 + audio.bass * 0.28 + audio.treble * 0.16;

    const pos = w.positions;
    const col = w.colors;
    const baseCol = w.baseColors;
    const bassLift = audio.bass * 1.45;
    const count = w.pointCount;
    const bioSignal = (this.bioValue || 0);

    // Dynamic rotation factors for Mode 2 (Reloj astronómico) & disassembly for Mode 3 (Monolitos)
    const clockRot1 = this.time * 0.45;
    const clockRot2 = -this.time * 0.65;
    const cos1 = Math.cos(clockRot1), sin1 = Math.sin(clockRot1);
    const cos2 = Math.cos(clockRot2), sin2 = Math.sin(clockRot2);

    // Disassembly expansion factor for monoliths (breathes and explodes outward with bass & bio)
    const monolithDisperse = Math.sin(this.time * 2.2) * (0.35 + audio.bass * 0.85 + bioSignal * 0.9);

    // Fast flat loop over 45,000 points (zero allocations -> steady 60 FPS)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let bx = currentPositions[i3] * (1.0 - morphT) + targetPositions[i3] * morphT;
      let by = currentPositions[i3 + 1] * (1.0 - morphT) + targetPositions[i3 + 1] * morphT;
      let bz = currentPositions[i3 + 2] * (1.0 - morphT) + targetPositions[i3 + 2] * morphT;

      // Mode-specific kinetic dynamics:
      if (w.currentMode === 2 || w.targetMode === 2) {
        // Astronomical Clock Ring rotations
        const ringIdx = i % 7;
        if (ringIdx === 1 || ringIdx === 4) {
          const rx = bx * cos1 - bz * sin1;
          const rz = bx * sin1 + bz * cos1;
          bx = rx; bz = rz;
        } else if (ringIdx === 2 || ringIdx === 5) {
          const rx = bx * cos2 - by * sin2;
          const ry = bx * sin2 + by * cos2;
          bx = rx; by = ry;
        }
      } else if (w.currentMode === 3 || w.targetMode === 3) {
        // Monolith blocks assembling and disassembling in space
        if (monolithDisperse > 0.05) {
          const disp = monolithDisperse * (0.4 + (i % 5) * 0.25);
          bx += (bx > 0 ? 1 : -1) * disp * 3.5;
          by += Math.sin(this.time * 4.0 + i * 0.1) * disp * 2.5;
          bz += (bz > -35 ? 1 : -1) * disp * 3.5;
        }
      }

      const dz = Math.abs(bz - scanZ);
      const bioWave = bioSignal > 0.01 ? Math.sin(this.time * 6.5 + i * 0.08) * bioSignal * 0.85 : 0;

      if (dz < scanWidth) {
        const hit = 1.0 - dz * invScanWidth;
        const flare = hit * hit;
        pos[i3] = bx + Math.sin(this.time * 18.0 + i * 0.13) * flare * (0.35 + bassLift * 0.4) + bioWave;
        pos[i3 + 1] = by + flare * (0.45 + bassLift) + bioWave;
        pos[i3 + 2] = bz + bioWave;
        col[i3] = Math.min(1.0, baseCol[i3] + flare * 0.9);
        col[i3 + 1] = Math.min(1.0, baseCol[i3 + 1] + flare * 0.95);
        col[i3 + 2] = Math.min(1.0, baseCol[i3 + 2] + flare * 1.0);
      } else {
        pos[i3] = bx + bioWave;
        pos[i3 + 1] = by + bioWave;
        pos[i3 + 2] = bz;
        col[i3] = baseCol[i3];
        col[i3 + 1] = baseCol[i3 + 1];
        col[i3 + 2] = baseCol[i3 + 2];
      }
    }

    w.lidarPoints.geometry.attributes.position.needsUpdate = true;
    w.lidarPoints.geometry.attributes.color.needsUpdate = true;
  }

  // ============================================================================
  // MASTER FRAME RENDERER
  // ============================================================================
  updateAudio(audioPayload) {
    if (!audioPayload) return;
    this.externalAudio = {
      bass: Number(audioPayload.bass) || 0,
      mid: Number(audioPayload.mid) || 0,
      treble: Number(audioPayload.treble) || 0,
      spectrum16: Array.isArray(audioPayload.spectrum16) ? audioPayload.spectrum16.slice(0, 16) : null
    };
  }

  renderFrame(dt, audioState, params, bpmPhase = 0) {
    if (!this.ok || !this.active || !this.renderer) return false;

    const safeDt = Math.min(0.08, Math.max(0.001, Number(dt) || 0.016));
    const speed = params ? Number(params.speed) || 0.3 : 0.3;
    this.time += safeDt * (0.45 + speed * 1.35);

    const audioSens = params ? Number(params.audioDepth) || 0.5 : 0.5;
    const rawBass = audioState ? Number(audioState.bass) || 0 : (this.externalAudio ? this.externalAudio.bass : 0);
    const rawMid = audioState ? Number(audioState.mid) || 0 : (this.externalAudio ? this.externalAudio.mid : 0);
    const rawTreble = audioState ? Number(audioState.treble) || 0 : (this.externalAudio ? this.externalAudio.treble : 0);
    const spec16 = (this.externalAudio && Array.isArray(this.externalAudio.spectrum16))
      ? this.externalAudio.spectrum16
      : (audioState && Array.isArray(audioState.spectrum16) ? audioState.spectrum16 : null);

    const instantEnergy = Math.min(1.0, (rawBass * 0.5 + rawMid * 0.35 + rawTreble * 0.25) * (0.4 + audioSens * 1.4));
    this.smoothEnergy = this.smoothEnergy * 0.82 + instantEnergy * 0.18;
    const audioEnergy = Math.max(this.smoothEnergy, instantEnergy * 0.85);

    const audio = {
      rawBass,
      rawMid,
      rawTreble,
      bass: rawBass * (0.45 + audioSens * 0.9),
      mid: rawMid * (0.45 + audioSens * 0.9),
      treble: rawTreble * (0.45 + audioSens * 0.9),
      spectrum16: spec16,
      bins: audioState && audioState.data ? audioState.data : null
    };

    const P = {
      frequency: params ? Number(params.frequency) || 0.35 : 0.35,
      detail: params ? Number(params.detail) || 0.5 : 0.5,
      speed
    };

    this._updateCamera(safeDt, speed, audioEnergy);

    // Bio-pulse soft decay
    if (this.bioValue > 0.001) {
      this.bioValue = Math.max(0.0, this.bioValue - safeDt * 0.85);
    }

    const w = this.worlds[this.worldIndex];
    if (!w) return false;

    if (this.worldIndex === 0) {
      this._updateAquariumWorld(w, safeDt, audio, P, audioEnergy);
    } else if (this.worldIndex === 1) {
      this._updateCyberWorld(w, safeDt, audio, P, audioEnergy);
    } else if (this.worldIndex === 2) {
      this._updateMyceliumWorld(w, safeDt, audio, P, audioEnergy);
    } else {
      this._updateCathedralWorld(w, safeDt, audio, P, audioEnergy, bpmPhase);
    }

    // Update active 3D weather particles & lightning flash
    this._updateWeatherSystem(w, safeDt, audio);

    // Update 3D Live Kinetic Typography floating in the active 3D world
    this._updateKineticText3D(audio, bpmPhase);

    this.renderer.render(w.scene, this.camera);
    return true;
  }
}

window.ThreeVisualEngine = ThreeVisualEngine;
