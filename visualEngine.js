/**
 * VORTEX VISUAL ENGINE — WebGL / GLSL emulation of a TouchDesigner TOP chain
 *
 *   [Media Texture OR Procedural Noise TOP] -> [Displace TOP] -> [Kaleido (Mirror) TOP]
 *     -> [HSV Adjust / Level TOP] -> [Feedback TOP (ping-pong FBO)] -> [Out]
 *
 * - Instant switching between Generative Mode (u_useTexture = 0.0) and Media Mode (u_useTexture = 1.0).
 * - Decodes static images via an offscreen 2D canvas before uploading to WebGL so Safari
 *   displays library and uploaded images on the very first frame without CORS/profile issues.
 * - Clears feedback FBOs on source switch so old frames never bleed into the new image.
 */

class VisualEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ok = false;
    this.error = null;
    this.onBeat = callbacks.onBeat || (() => {});
    this.onFps = callbacks.onFps || (() => {});

    // Parameters. Most are normalized 0..1; `bpm` is raw BPM.
    this.params = {
      // 0. Source Mode ('generator' | 'media')
      useTexture: 0.0,
      // 1. Source / Generator
      genMode: 0, frequency: 0.35, detail: 0.5, speed: 0.35, mix: 1.0,
      // 2. Modulation / Displace
      displace: 0.15, warpScale: 0.45, audioDepth: 0.5,
      // 3. Feedback / Color
      feedback: 0.45, chroma: 0.2, hue: 0.0, contrast: 0.5, monochrome: false,
      // 4. Master / Tempo & Beat Pulse (Pulse OFF by default)
      kaleido: 0.0, mirrorAngle: 0.0, bpm: 120,
      pulseEnabled: false,
      pulseEnvelope: 0.0, // 0..1 envelope computed from beatPhase when Pulse is ON
      beatMultiplier: 1,  // 1 (x1 beat), 2 (x2 beats), 4 (x4 beats)
      waveShape: 'sine',  // 'sine' | 'saw' | 'square' | 'triangle'
      lfoDepth: 0.35,
      lfoTarget: 'deform', // deform | kaleido | color | all
      // Toggles
      freeze: false, invert: false, pixelCrt: false, burst: 0.0
    };

    this.sourceMode = 'generator'; // 'generator' | 'media'
    this.audio = {
      active: false,
      mode: 'none', // 'none' | 'device' | 'file'
      context: null,
      analyser: null,
      stream: null,
      streamSource: null,
      monitorGain: null,
      masterGain: null,
      thruEnabled: false,
      element: null,
      mediaSource: null,
      objectUrl: null,
      deviceId: '',
      fileName: '',
      data: null,
      bass: 0,
      mid: 0,
      treble: 0,
      spectrum16: new Array(16).fill(0)
    };
    this.media = { el: null, type: null, texture: null, width: 1, height: 1, ready: false, has: false };
    this.mediaTransform = { x: 0.0, y: 0.0, zoom: 1.0 };

    this.textStyle = { fontFamily: 'Impact', fontSize: 60, color: '#ff0055', borderStyle: 'neon' };
    this.bioValue = 0.0;
    this.bioDelta = 0.0;

    // Offscreen 2D canvas for reliable image pixel decoding in Safari WebGL
    this.stagingCanvas = document.createElement('canvas');
    this.stagingCtx = this.stagingCanvas.getContext('2d');

    // Optional Three.js 3D Engine (paused at 0% GPU unless sourceMode === 'three')
    this.threeEngine = (typeof ThreeVisualEngine !== 'undefined')
      ? new ThreeVisualEngine({
          width: 960,
          height: 540,
          onCameraReset: callbacks.onThreeCameraReset || null
        })
      : null;

    this.isRunning = false;
    this.running = false;
    this.rafId = null;
    this._boundFrame = this.frame.bind(this);
    this.phase = 0;
    this.beatPos = 0;
    this.lastBeatIndex = -1;
    this.lastTime = 0;
    this.frames = 0;
    this.fpsTime = 0;
    this.fps = 0;

    try {
      this.gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      }) || canvas.getContext('experimental-webgl');

      if (!this.gl) throw new Error('WebGL no está disponible en este navegador.');
      this.initPrograms();
      this.initGeometry();
      this.initMediaTexture();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.ok = true;
    } catch (err) {
      this.error = err.message || String(err);
      console.error('[VisualEngine]', this.error);
    }
  }

  // ---------------------------------------------------------------- Shaders
  static get VERTEX() {
    return `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }`;
  }

  static get BLIT() {
    return `
      precision mediump float;
      varying vec2 v_uv;
      uniform sampler2D u_tex;
      uniform float u_opacity;
      void main() { gl_FragColor = vec4(texture2D(u_tex, v_uv).rgb * u_opacity, 1.0); }`;
  }

  static get FRAGMENT() {
    return `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
      #else
        precision mediump float;
      #endif
      varying vec2 v_uv;

      uniform vec2  u_res;
      uniform float u_time;
      uniform sampler2D u_prev;
      uniform sampler2D u_media;
      uniform float u_useTexture;
      uniform vec2  u_mediaRes;
      uniform vec2  u_mediaOffset;
      uniform float u_mediaZoom;

      uniform int   u_genMode;
      uniform float u_freq;
      uniform float u_detail;
      uniform float u_displace;
      uniform float u_warpScale;
      uniform float u_feedback;
      uniform float u_fbZoom;
      uniform float u_chroma;
      uniform float u_hue;
      uniform float u_contrast;
      uniform float u_mono;
      uniform float u_kaleido;
      uniform float u_zoom;
      uniform float u_rot;
      uniform float u_burst;
      uniform float u_beat;
      uniform float u_invert;
      uniform float u_pixelCrt;
      uniform float u_bass;
      uniform float u_mid;
      uniform float u_treble;

      #define PI 3.14159265359
      #define TWO_PI 6.28318530718

      // ---- Simplex noise 3D (Ashima Arts, MIT) ----
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
                 + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      float fbm(vec3 p, float detail) {
        float v = 0.0, a = 0.5;
        int oct = 2 + int(detail * 4.0);
        for (int i = 0; i < 6; i++) {
          if (i >= oct) break;
          v += a * snoise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      // Mirrored repeat so kaleido / zoom-out never shows black borders
      vec2 mirrorUV(vec2 uv) { return 1.0 - abs(mod(uv, 2.0) - 1.0); }

      // Aspect "cover" fit of the media inside the screen (centered space)
      vec2 coverUV(vec2 q, float aspect) {
        float ma = u_mediaRes.x / max(u_mediaRes.y, 1.0);
        vec2 size = (ma > aspect) ? vec2(ma, 1.0) : vec2(aspect, aspect / ma);
        vec2 centeredUv = (q / size) / max(u_mediaZoom, 0.05) + 0.5 + u_mediaOffset;
        return clamp(mirrorUV(centeredUv), 0.001, 0.999);
      }

      vec3 generator(vec2 p, float t) {
        float f = 0.8 + u_freq * 5.0;
        float n;
        if (u_genMode == 0) {            // Fluid noise contours
          n = fbm(vec3(p * f, t * 0.6), u_detail) * 0.5 + 0.5;
          n = sin(n * 10.0 + t) * 0.5 + 0.5;
        } else if (u_genMode == 1) {     // Vortex tunnel
          float r = length(p);
          float a = atan(p.y, p.x);
          n = sin(0.5 / (r + 0.06) * f * 2.0 - t * 3.0 + a * 3.0) * 0.5 + 0.5;
        } else if (u_genMode == 2) {     // Concentric rings
          n = cos(length(p) * f * 9.0 - t * 2.5 + fbm(vec3(p * 2.0, t * 0.3), u_detail) * 2.0);
          n = smoothstep(0.0, 1.0, abs(n));
        } else {                         // Interference geometry
          float v1 = sin(p.x * f * 4.0 + t);
          float v2 = sin(p.y * f * 4.0 - t * 0.8);
          float v3 = sin((p.x + p.y) * f * 2.5 + t * 1.3);
          n = (v1 + v2 + v3) / 6.0 + 0.5;
        }
        float hue = fract(0.55 + n * 0.35 + u_mid * 0.15);
        return hsv2rgb(vec3(hue, 0.8, pow(n, 1.3)));
      }

      void main() {
        float aspect = u_res.x / max(u_res.y, 1.0);
        vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0);

        // Master transform (zoom / rotate, LFO-driven)
        p /= u_zoom;
        float cr = cos(u_rot), sr = sin(u_rot);
        p = mat2(cr, sr, -sr, cr) * p;

        // Kaleidoscope TOP
        if (u_kaleido > 0.01) {
          float slices = floor(2.0 + u_kaleido * 14.0);
          float seg = TWO_PI / slices;
          float a = mod(atan(p.y, p.x), seg);
          a = abs(a - seg * 0.5);
          p = vec2(cos(a), sin(a)) * length(p);
        }

        // Pixel / CRT quantized mosaic reactive to bass
        if (u_pixelCrt > 0.5) {
          float gridDensity = mix(54.0, 14.0, clamp(u_bass * 1.15 + 0.12, 0.0, 1.0));
          p = (floor(p * gridDensity) + 0.5) / gridDensity;
        }

        // Displace TOP (noise-driven UV warp)
        float t = u_time;
        vec2 wq = p * (1.0 + u_warpScale * 6.0);
        vec2 warp = vec2(snoise(vec3(wq, t * 0.35)), snoise(vec3(wq + 7.3, t * 0.35 + 3.1)));
        float crtWave = (u_pixelCrt > 0.5)
          ? sin(v_uv.y * 44.0 + t * 8.0) * (0.008 + u_bass * 0.022)
          : 0.0;

        vec3 src;
        if (u_useTexture > 0.5) {
          // MEDIA MODE: sample the active image/video/webcam texture directly
          vec2 pw = p + warp * (u_displace * 0.14 + u_bass * 0.06);
          float len = length(pw);
          vec2 radialDir = (len > 0.0001 ? pw / len : vec2(1.0, 0.0)) * (u_chroma * 0.035 + u_treble * 0.01);
          vec2 orthoDir = vec2(-radialDir.y, radialDir.x) * (u_chroma * 0.35);
          vec2 rgbOffset = radialDir + vec2(crtWave, 0.0);
          src = vec3(
            texture2D(u_media, coverUV(pw + rgbOffset, aspect)).r,
            texture2D(u_media, coverUV(pw + orthoDir, aspect)).g,
            texture2D(u_media, coverUV(pw - rgbOffset, aspect)).b
          );
        } else {
          // GENERATIVE MODE: procedural noise synth
          vec2 pw = p + warp * (u_displace * 0.25 + u_bass * 0.08);
          float len = length(pw);
          vec2 radialDir = (len > 0.0001 ? pw / len : vec2(1.0, 0.0)) * (u_chroma * 0.035 + u_treble * 0.01);
          vec2 crtOff = u_pixelCrt > 0.5 ? vec2(crtWave * 1.6, 0.0) : vec2(0.0);
          vec2 totalOff = radialDir + crtOff;
          if (length(totalOff) > 0.0002) {
            src = vec3(
              generator(pw + totalOff, t).r,
              generator(pw, t).g,
              generator(pw - totalOff, t).b
            );
          } else {
            src = generator(pw, t);
          }
        }

        // HSV Adjust + Psychedelic Saturation & Chromatic Contrast Boost (CHROMA knob)
        if (u_hue > 0.001 || u_chroma > 0.001) {
          vec3 h = rgb2hsv(src);
          h.x = fract(h.x + u_hue);
          float saturation = 1.0 + u_chroma * 1.8;
          h.y = clamp(h.y * saturation + u_chroma * 0.18, 0.0, 1.0);
          src = hsv2rgb(h);
          if (u_chroma > 0.001) {
            src = clamp((src - 0.5) * (1.0 + u_chroma * 0.45) + 0.5, 0.0, 1.0);
          }
        }

        if (u_useTexture < 0.5) {
          src = clamp((src - 0.5) * (0.5 + u_contrast) + 0.5, 0.0, 1.0);
        }

        // Feedback TOP (previous frame, slightly zoomed + rotated, RGB split)
        vec2 fuv = v_uv - 0.5;
        float fr = 0.0025;
        fuv = mat2(cos(fr), sin(fr), -sin(fr), cos(fr)) * fuv;
        fuv = fuv * u_fbZoom + 0.5;
        vec2 fdir = (v_uv - 0.5) * u_chroma * 0.024 + vec2(crtWave * 0.5, 0.0);
        vec3 fb = vec3(texture2D(u_prev, fuv + fdir).r,
                       texture2D(u_prev, fuv).g,
                       texture2D(u_prev, fuv - fdir).b);

        float w = u_feedback;
        vec3 col;
        if (u_useTexture > 0.5) {
          // Clean proportional motion trail on media so the image stays 100% visible and never washes out
          col = mix(src, fb * 0.96, w * 0.65);
        } else {
          col = mix(src, fb, w);
        }

        // Only manual Flash burst adds brightness; BPM pulse modulates target FX without brightness flicker
        col += vec3(u_burst * 0.6);

        if (u_pixelCrt > 0.5) {
          float scanline = 0.76 + 0.24 * sin(gl_FragCoord.y * 1.5 + t * 5.0);
          float aperture = 0.92 + 0.08 * sin(gl_FragCoord.x * 2.2);
          col *= scanline * aperture;
        }

        if (u_mono > 0.5) {
          float luma = dot(col, vec3(0.299, 0.587, 0.114));
          col = vec3(clamp((luma - 0.5) * 1.45 + 0.5, 0.0, 1.0));
        }
        if (u_invert > 0.5) col = 1.0 - col;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`;
  }

  compile(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Error compilando shader: ' + log);
    }
    return shader;
  }

  link(vsSrc, fsSrc, uniformNames) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, this.compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(program, this.compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.bindAttribLocation(program, 0, 'a_position');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Error enlazando programa: ' + gl.getProgramInfoLog(program));
    }
    const u = {};
    uniformNames.forEach(n => { u[n] = gl.getUniformLocation(program, n); });
    return { program, u };
  }

  initPrograms() {
    this.main = this.link(VisualEngine.VERTEX, VisualEngine.FRAGMENT, [
      'u_res', 'u_time', 'u_prev', 'u_media', 'u_useTexture', 'u_mediaRes',
      'u_mediaOffset', 'u_mediaZoom',
      'u_genMode', 'u_freq', 'u_detail', 'u_displace', 'u_warpScale',
      'u_feedback', 'u_fbZoom', 'u_chroma', 'u_hue', 'u_contrast', 'u_mono',
      'u_kaleido', 'u_zoom', 'u_rot', 'u_burst', 'u_beat', 'u_invert', 'u_pixelCrt',
      'u_bass', 'u_mid', 'u_treble'
    ]);
    this.blit = this.link(VisualEngine.VERTEX, VisualEngine.BLIT, ['u_tex', 'u_opacity']);
  }

  initGeometry() {
    const gl = this.gl;
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  }

  makeTexture() {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  initMediaTexture() {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    this.media.texture = this.makeTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.activeTexture(gl.TEXTURE0);
  }

  createFBO(w, h) {
    const gl = this.gl;
    const texture = this.makeTexture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, texture };
  }

  clearFBOs() {
    if (!this.gl) return;
    const gl = this.gl;
    [this.fboA, this.fboB].forEach(target => {
      if (target && target.fbo) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  deleteFBO(f) {
    if (!f) return;
    this.gl.deleteFramebuffer(f.fbo);
    this.gl.deleteTexture(f.texture);
  }

  resize() {
    if (!this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.floor(window.innerWidth * dpr));
    const h = Math.max(2, Math.floor(window.innerHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.fboA) return;
    this.canvas.width = w;
    this.canvas.height = h;
    this.deleteFBO(this.fboA);
    this.deleteFBO(this.fboB);
    this.fboA = this.createFBO(w, h);
    this.fboB = this.createFBO(w, h);
  }

  setTextStyle(fontFamily, fontSize, color, borderStyle) {
    this.textStyle = {
      fontFamily: fontFamily || this.textStyle.fontFamily || 'Impact',
      fontSize: Math.max(10, Math.min(150, Number(fontSize !== undefined ? fontSize : this.textStyle.fontSize) || 60)),
      color: color || this.textStyle.color || '#ff0055',
      borderStyle: borderStyle || this.textStyle.borderStyle || 'neon'
    };
    if (this.threeEngine && typeof this.threeEngine.setTextStyle === 'function') {
      this.threeEngine.setTextStyle(
        this.textStyle.fontFamily,
        this.textStyle.fontSize,
        this.textStyle.color,
        this.textStyle.borderStyle
      );
    }
  }

  setBioInput(value, delta) {
    this.bioValue = Math.max(0.0, Math.min(1.0, Number(value) || 0));
    this.bioDelta = Number(delta) || 0;
    if (this.threeEngine && typeof this.threeEngine.setBioInput === 'function') {
      this.threeEngine.setBioInput(this.bioValue, this.bioDelta);
    }
  }

  // ---------------------------------------------------------------- Media & 3D Bridge
  setMediaTransform(x = 0, y = 0, zoom = 1) {
    const nx = Number(x);
    const ny = Number(y);
    const nz = Number(zoom);
    this.mediaTransform.x = Number.isFinite(nx) ? Math.max(-1, Math.min(1, nx)) : 0.0;
    this.mediaTransform.y = Number.isFinite(ny) ? Math.max(-1, Math.min(1, ny)) : 0.0;
    this.mediaTransform.zoom = Number.isFinite(nz) ? Math.max(0.1, Math.min(4, nz)) : 1.0;
  }

  /** element: HTMLImageElement | HTMLVideoElement (already loaded / playing) */
  setMedia(element, type) {
    if (this.threeEngine) this.threeEngine.setActive(false);
    this.setMediaTransform(0, 0, 1);
    this.media.el = element;
    this.media.type = type; // 'image' | 'video' | 'camera'
    this.media.width = element.videoWidth || element.naturalWidth || element.width || 1280;
    this.media.height = element.videoHeight || element.naturalHeight || element.height || 720;
    this.media.ready = false;
    this.media.has = true;
    this.sourceMode = 'media';
    this.params.useTexture = 1.0;

    // Clear feedback FBOs so the new image appears immediately without old noise
    this.clearFBOs();
    this.uploadMediaFrame(true);
  }

  clearMedia() {
    if (this.threeEngine) this.threeEngine.setActive(false);
    this.media.el = null;
    this.media.type = null;
    this.media.ready = false;
    this.media.has = false;
    this.sourceMode = 'generator';
    this.params.useTexture = 0.0;
    this.clearFBOs();
  }

  setThreeWorld(worldIndex) {
    if (!this.threeEngine || !this.threeEngine.ok) return false;
    this.media.el = null;
    this.media.type = 'three';
    this.media.width = this.threeEngine.width;
    this.media.height = this.threeEngine.height;
    this.media.ready = true;
    this.media.has = true;
    this.sourceMode = 'three';
    this.params.useTexture = 1.0;
    this.threeEngine.setWorld(worldIndex);
    this.threeEngine.setActive(true);
    this.clearFBOs();
    return true;
  }

  setThreeCameraOrbit(norm01) {
    if (this.threeEngine) this.threeEngine.setCameraOrbitNormalized(norm01);
  }

  setThreeCameraZoom(norm01) {
    if (this.threeEngine) this.threeEngine.setCameraZoomNormalized(norm01);
  }

  resetThreeCamera() {
    if (this.threeEngine) this.threeEngine.resetCamera(true);
  }

  uploadThreeFrame(dt) {
    if (this.sourceMode !== 'three' || !this.threeEngine || !this.threeEngine.ok || !this.gl) return;
    if (!this.threeEngine.active) this.threeEngine.setActive(true);
    this.threeEngine.renderFrame(dt, this.audio, this.params, this.beatPos);

    const gl = this.gl;
    try {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.media.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.threeEngine.canvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.activeTexture(gl.TEXTURE0);
      this.media.width = this.threeEngine.canvas.width;
      this.media.height = this.threeEngine.canvas.height;
      this.media.ready = true;
      this.media.has = true;
    } catch (err) {
      console.warn('[VisualEngine] Error subiendo frame Three.js a textura WebGL:', err);
    }
  }

  uploadMediaFrame(force = false) {
    const m = this.media;
    if (!m.el || !this.gl) return;
    const isVideo = m.type === 'video' || m.type === 'camera';
    if (isVideo) {
      if (m.el.readyState < 2) return;
      m.width = m.el.videoWidth || m.width || 1280;
      m.height = m.el.videoHeight || m.height || 720;
    } else if (!force && m.ready) {
      return; // static image already uploaded
    }

    const gl = this.gl;
    try {
      let uploadSource = m.el;

      // For static images, rasterize to offscreen 2D canvas first for 100% Safari WebGL reliability
      if (!isVideo && this.stagingCtx) {
        const w = Math.min(2048, Math.max(2, m.el.naturalWidth || m.el.width || 1280));
        const h = Math.min(2048, Math.max(2, m.el.naturalHeight || m.el.height || 720));
        this.stagingCanvas.width = w;
        this.stagingCanvas.height = h;
        this.stagingCtx.clearRect(0, 0, w, h);
        this.stagingCtx.drawImage(m.el, 0, 0, w, h);
        uploadSource = this.stagingCanvas;
        m.width = w;
        m.height = h;
      }

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, m.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uploadSource);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.activeTexture(gl.TEXTURE0);

      m.ready = true;
      m.has = true;
      this.sourceMode = 'media';
      this.params.useTexture = 1.0;
    } catch (err) {
      console.warn('[VisualEngine] Error subiendo textura a WebGL:', err);
      this.error = 'No se pudo cargar la textura en WebGL.';
    }
  }

  // ---------------------------------------------------------------- Audio
  _ensureAudioGraph() {
    const a = this.audio;
    if (!a.context) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      a.context = new AudioCtx();
    }
    if (!a.analyser) {
      a.analyser = a.context.createAnalyser();
      a.analyser.fftSize = 1024;
      a.analyser.smoothingTimeConstant = 0.72;
      a.data = new Uint8Array(a.analyser.frequencyBinCount);
    }
    if (!a.masterGain) {
      a.masterGain = a.context.createGain();
      a.masterGain.gain.value = 1.0;
      // Permanent route to hardware speakers — NEVER disconnect masterGain
      a.masterGain.connect(a.context.destination);
    }
    if (!a.monitorGain) {
      a.monitorGain = a.context.createGain();
      a.monitorGain.gain.value = a.thruEnabled ? 1.0 : 0.0;
      // Permanent route monitorGain -> masterGain so toggling Thru never breaks the graph
      a.monitorGain.connect(a.masterGain);
    }
    return a;
  }

  /** Route or mute live input stream through masterGain -> destination (Audio Thru) without disconnecting nodes. */
  setMonitorThru(enabled) {
    const a = this._ensureAudioGraph();
    a.thruEnabled = Boolean(enabled);
    if (!a.monitorGain) return a.thruEnabled;
    if (a.context.state === 'suspended') {
      a.context.resume().catch(() => {});
    }
    a.monitorGain.gain.setValueAtTime(a.thruEnabled ? 1.0 : 0.0, a.context.currentTime);
    return a.thruEnabled;
  }

  _disconnectAudioInputs() {
    const a = this.audio;
    try {
      if (a.stream) {
        a.stream.getTracks().forEach(t => t.stop());
        a.stream = null;
      }
    } catch (e) {}
    try {
      if (a.streamSource) {
        a.streamSource.disconnect();
        a.streamSource = null;
      }
    } catch (e) {}
    // NEVER disconnect a.mediaSource, a.analyser, a.monitorGain, or a.masterGain!
  }

  /** Capture live audio from a specific input device (e.g. BlackHole 2ch, SSL 2) or default mic. */
  async startDeviceAudio(deviceId = '') {
    const a = this._ensureAudioGraph();
    this._disconnectAudioInputs();

    const rawConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    const constraints = deviceId
      ? { audio: { deviceId: { exact: deviceId }, ...rawConstraints }, video: false }
      : { audio: rawConstraints, video: false };

    try {
      a.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      const fallback = deviceId ? { audio: { deviceId: { exact: deviceId } }, video: false } : { audio: true, video: false };
      a.stream = await navigator.mediaDevices.getUserMedia(fallback);
    }

    if (a.context.state === 'suspended') {
      await a.context.resume();
    }

    a.streamSource = a.context.createMediaStreamSource(a.stream);
    a.streamSource.connect(a.analyser);
    if (a.monitorGain) {
      a.streamSource.connect(a.monitorGain);
      this.setMonitorThru(a.thruEnabled);
    }
    a.deviceId = deviceId || '';
    a.mode = 'device';
    a.active = true;
    return true;
  }

  /** Load and play a local audio file routed permanently through MediaElementAudioSourceNode -> Analyser & MasterGain. */
  async loadAudioFile(file) {
    if (!file) return { active: false, fileName: '' };
    const a = this._ensureAudioGraph();
    this._disconnectAudioInputs();

    if (!a.element) {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.loop = true;
      el.preload = 'auto';
      a.element = el;
      a.mediaSource = a.context.createMediaElementSource(el);
    }

    if (!a._mediaSourceWired && a.mediaSource) {
      a.mediaSource.connect(a.analyser);
      a.mediaSource.connect(a.masterGain);
      a._mediaSourceWired = true;
    }

    if (a.objectUrl) {
      try { URL.revokeObjectURL(a.objectUrl); } catch (e) {}
      a.objectUrl = null;
    }

    a.objectUrl = URL.createObjectURL(file);
    a.element.src = a.objectUrl;
    a.element.muted = false;
    a.element.volume = 1.0;

    if (a.context.state === 'suspended') {
      await a.context.resume();
    }

    await a.element.play();
    a.fileName = file.name || 'Audio Local';
    a.mode = 'file';
    a.active = true;
    return { active: true, fileName: a.fileName };
  }

  async toggleAudioFilePlayback() {
    const a = this.audio;
    if (a.mode !== 'file' || !a.element) return false;
    if (a.element.paused) {
      if (a.context && a.context.state === 'suspended') {
        await a.context.resume();
      }
      await a.element.play();
      a.active = true;
      return true;
    }
    a.element.pause();
    a.active = false;
    a.bass = a.mid = a.treble = 0;
    if (Array.isArray(a.spectrum16)) a.spectrum16.fill(0);
    return false;
  }

  stopAudio() {
    const a = this.audio;
    this._disconnectAudioInputs();
    a.active = false;
    a.mode = 'none';
    a.bass = a.mid = a.treble = 0;
    if (Array.isArray(a.spectrum16)) a.spectrum16.fill(0);
  }

  async toggleAudio(deviceId = '') {
    if (this.audio.active) {
      this.stopAudio();
      return false;
    }
    return this.startDeviceAudio(deviceId);
  }

  readAudio(audioSensOverride = null) {
    const a = this.audio;
    if (!a.active || !a.analyser) return;
    if (a.analyser.fftSize !== 1024) a.analyser.fftSize = 1024;
    if (a.analyser.smoothingTimeConstant !== 0.72) a.analyser.smoothingTimeConstant = 0.72;
    if (!a.data || a.data.length !== a.analyser.frequencyBinCount) {
      a.data = new Uint8Array(a.analyser.frequencyBinCount);
    }
    a.analyser.getByteFrequencyData(a.data);

    const sampleRate = (a.context && a.context.sampleRate) ? a.context.sampleRate : 44100;
    const fftSize = a.analyser.fftSize || 1024;
    const binHz = sampleRate / fftSize;
    const maxBin = a.data.length - 1;

    const rawSens = (audioSensOverride !== null && audioSensOverride !== undefined)
      ? Number(audioSensOverride)
      : (Number(this.params.audioDepth) || 0.5);
    const audioSens = rawSens <= 0.01 ? 0 : (0.55 + Math.min(1.0, rawSens) * 0.9);

    const avgRange = (from, to) => {
      const start = Math.max(1, Math.min(maxBin, from));
      const end = Math.max(start, Math.min(maxBin, to));
      let s = 0;
      for (let i = start; i <= end; i++) s += a.data[i];
      return s / ((end - start + 1) * 255);
    };

    const bassFrom = Math.max(1, Math.round(20 / binHz));
    const bassTo = Math.max(bassFrom + 1, Math.round(250 / binHz));
    const midFrom = bassTo;
    const midTo = Math.max(midFrom + 1, Math.round(2500 / binHz));
    const trebleFrom = midTo;
    const trebleTo = Math.min(maxBin, Math.max(trebleFrom + 1, Math.round(12000 / binHz)));

    const bassRaw = avgRange(bassFrom, bassTo);
    const midRaw = avgRange(midFrom, midTo);
    const trebleRaw = avgRange(trebleFrom, trebleTo);

    a.bass = Math.min(1.0, Math.max(0.0, bassRaw * 0.95 * audioSens));
    a.mid = Math.min(1.0, Math.max(0.0, Math.pow(midRaw, 0.85) * 1.65 * audioSens));
    a.treble = Math.min(1.0, Math.max(0.0, Math.pow(trebleRaw, 0.78) * 2.85 * audioSens));

    if (!Array.isArray(a.spectrum16) || a.spectrum16.length !== 16) {
      a.spectrum16 = new Array(16).fill(0);
    }
    const fMin = 40;
    const fMax = 12000;
    const fRatio = fMax / fMin;
    for (let i = 0; i < 16; i++) {
      const fLow = fMin * Math.pow(fRatio, i / 16);
      const fHigh = fMin * Math.pow(fRatio, (i + 1) / 16);
      const bStart = Math.max(1, Math.min(maxBin, Math.floor(fLow / binHz)));
      const bEnd = Math.max(bStart, Math.min(maxBin, Math.ceil(fHigh / binHz)));
      const bandVal = avgRange(bStart, bEnd);
      const preEmphasis = 1.0 + i * 0.18;
      a.spectrum16[i] = Math.min(1.0, Math.max(0.0, Math.pow(bandVal, 0.88) * preEmphasis * audioSens));
    }
  }

  // ---------------------------------------------------------------- API
  setParam(name, value) {
    if (name in this.params) this.params[name] = value;
  }

  setBPM(bpm) {
    this.params.bpm = Math.max(40, Math.min(200, Number(bpm) || 120));
  }

  setPulseEnabled(enabled) {
    this.params.pulseEnabled = Boolean(enabled);
    if (!this.params.pulseEnabled) {
      this.params.pulseEnvelope = 0.0;
    }
  }

  setPulseEnvelope(val) {
    this.params.pulseEnvelope = this.params.pulseEnabled ? Math.max(0.0, Math.min(1.0, Number(val) || 0)) : 0.0;
  }

  setBeatMultiplier(mult) {
    this.params.beatMultiplier = Number(mult) || 1;
  }

  setWaveShape(shape) {
    this.params.waveShape = String(shape || 'sine').toLowerCase();
  }

  setLfoTarget(target) {
    const map = { 0: 'deform', 1: 'kaleido', 2: 'color', 3: 'all' };
    this.params.lfoTarget = map[target] !== undefined ? map[target] : String(target || 'deform').toLowerCase();
  }

  triggerBurst() { this.params.burst = 1.0; }

  resyncBeat() {
    this.beatPos = Math.ceil(this.beatPos);
  }

  // ---------------------------------------------------------------- Loop
  frame(now) {
    if (!this.isRunning) {
      this.rafId = null;
      return;
    }

    try {
      const gl = this.gl;
      const P = this.params;
      const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;

      // FPS
      this.frames++;
      if (now - this.fpsTime >= 1000) {
        this.fps = this.frames;
        this.frames = 0;
        this.fpsTime = now;
        this.onFps(this.fps);
      }

      this.readAudio();

      // Clock: speed-controlled animation phase + BPM beat accumulator
      const bpmVal = Math.max(40, Math.min(200, Number(P.bpm) || 120));
      const bpmScale = Math.max(0.25, bpmVal / 120.0);
      this.phase += dt * (0.1 + P.speed * 1.8) * bpmScale;
      this.beatPos += dt * (bpmVal / 60.0);

      if (this.sourceMode === 'three') {
        if (!P.freeze) {
          this.uploadThreeFrame(dt);
        }
      } else {
        if (this.threeEngine && this.threeEngine.active) {
          this.threeEngine.setActive(false);
        }
        this.uploadMediaFrame();
      }

      // Beat / Pulse Envelope (Strictly 0.0 when Pulse is OFF!)
      const pulseActive = Boolean(P.pulseEnabled);
      const pulseEnv = pulseActive ? P.pulseEnvelope : 0.0;
      const bi = pulseActive ? (pulseEnv * 2.0 - 1.0) * P.lfoDepth : 0.0;
      const uni = pulseActive ? pulseEnv * P.lfoDepth : 0.0;

      const T = P.lfoTarget;
      const modDeform = pulseActive && (T === 'deform' || T === 'warp' || T === 'all');
      const modKaleido = pulseActive && (T === 'kaleido' || T === 'rotate' || T === 'all');
      const modColor = pulseActive && (T === 'color' || T === 'hue' || T === 'all');

      const bass = this.audio.bass * P.audioDepth;
      const zoom = 1.0 + bass * 0.14;
      const rot = P.mirrorAngle * Math.PI * 2 + (modKaleido ? bi * 0.42 : 0.0);
      const bioDeform = (this.bioValue || 0) * 0.35;
      const displace = Math.min(1.8, P.displace + (modDeform ? uni * 0.58 : 0.0) + bioDeform);
      const warpScale = Math.min(1.8, P.warpScale + (modDeform ? uni * 0.45 : 0.0) + bioDeform * 0.4);
      const hue = (P.hue + (modColor ? uni * 0.45 : 0.0)) % 1.0;
      const chroma = Math.min(1.5, P.chroma + (modColor ? uni * 0.45 : 0.0));
      const kaleido = Math.min(1.0, P.kaleido + (modKaleido ? uni * 0.48 : 0.0));

      if (P.burst > 0.001) P.burst *= 0.86; else P.burst = 0;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // Pass 1: render the TOP chain into fboA, reading fboB as feedback.
      if (!P.freeze) {
        const { program, u } = this.main;
        gl.useProgram(program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA.fbo);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fboB.texture);
        gl.uniform1i(u.u_prev, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.media.texture);
        gl.uniform1i(u.u_media, 1);

        const useTexFlag = ((this.sourceMode === 'media' || this.sourceMode === 'three') && this.media.ready) ? 1.0 : 0.0;

        gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
        gl.uniform1f(u.u_time, this.phase);
        gl.uniform1f(u.u_useTexture, useTexFlag);
        gl.uniform2f(u.u_mediaRes, this.media.width, this.media.height);
        const isMediaSource = this.sourceMode === 'media';
        gl.uniform2f(
          u.u_mediaOffset,
          isMediaSource ? this.mediaTransform.x : 0.0,
          isMediaSource ? this.mediaTransform.y : 0.0
        );
        gl.uniform1f(u.u_mediaZoom, isMediaSource ? this.mediaTransform.zoom : 1.0);
        gl.uniform1i(u.u_genMode, P.genMode | 0);
        gl.uniform1f(u.u_freq, P.frequency);
        gl.uniform1f(u.u_detail, P.detail);
        gl.uniform1f(u.u_displace, displace);
        gl.uniform1f(u.u_warpScale, warpScale);
        gl.uniform1f(u.u_feedback, Math.min(0.97, P.feedback));
        gl.uniform1f(u.u_fbZoom, 0.994 - bass * 0.012);
        gl.uniform1f(u.u_chroma, chroma);
        gl.uniform1f(u.u_hue, hue);
        gl.uniform1f(u.u_contrast, P.contrast);
        gl.uniform1f(u.u_mono, P.monochrome ? 1.0 : 0.0);
        gl.uniform1f(u.u_kaleido, kaleido);
        gl.uniform1f(u.u_zoom, Math.max(0.2, zoom));
        gl.uniform1f(u.u_rot, rot);
        gl.uniform1f(u.u_burst, P.burst);
        gl.uniform1f(u.u_beat, 0.0);
        gl.uniform1f(u.u_invert, P.invert ? 1 : 0);
        gl.uniform1f(u.u_pixelCrt, P.pixelCrt ? 1.0 : 0.0);
        gl.uniform1f(u.u_bass, bass);
        gl.uniform1f(u.u_mid, this.audio.mid * P.audioDepth);
        gl.uniform1f(u.u_treble, this.audio.treble * P.audioDepth);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // swap: newest frame is now fboB
        const tmp = this.fboA; this.fboA = this.fboB; this.fboB = tmp;
      }

      // Pass 2: blit the newest frame to the screen.
      gl.useProgram(this.blit.program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboB.texture);
      gl.uniform1i(this.blit.u.u_tex, 0);
      gl.uniform1f(this.blit.u.u_opacity, P.mix !== undefined ? Math.max(0.0, Math.min(1.0, Number(P.mix))) : 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } catch (err) {
      console.warn('[VisualEngine] Frame recovered from error:', err);
    } finally {
      if (this.isRunning) {
        this.rafId = requestAnimationFrame(this._boundFrame);
      } else {
        this.rafId = null;
      }
    }
  }

  resetEngine() {
    if (!this.ok) return;
    this.params.freeze = false;
    this.params.invert = false;
    this.params.pixelCrt = false;
    this.params.monochrome = false;
    this.params.burst = 0.0;
    this.params.mix = 1.0;
    this.bioValue = 0.0;
    this.bioDelta = 0.0;
    this.phase = 0;
    this.lastTime = performance.now();
    this.fpsTime = this.lastTime;

    this.resize();
    this.clearFBOs();

    if (this.threeEngine) {
      this.threeEngine.time = 0;
      this.threeEngine.flightPhase = 0;
      this.threeEngine.bioValue = 0;
      this.threeEngine.keys = Object.create(null);
      if (this.threeEngine.pointer) this.threeEngine.pointer.dragging = false;
      this.threeEngine.resetCamera(true);
      this.threeEngine.setActive(this.sourceMode === 'three');
    }

    if (this.sourceMode === 'media' && this.media && this.media.el) {
      if (this.media.type === 'video' && typeof this.media.el.play === 'function' && this.media.el.paused) {
        this.media.el.play().catch(() => {});
      }
      this.uploadMediaFrame(true);
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRunning = true;
    this.running = true;
    this.paused = false;
    this.rafId = requestAnimationFrame(this._boundFrame);
  }

  clearCanvas() {
    const gl = this.gl;
    if (!gl) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.flush();
  }

  start() {
    if (!this.ok || this.isRunning) return;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isRunning = true;
    this.running = true;
    this.paused = false;
    if (this.threeEngine) {
      this.threeEngine.setActive(this.sourceMode === 'three');
    }
    this.lastTime = performance.now();
    this.fpsTime = this.lastTime;
    this.rafId = requestAnimationFrame(this._boundFrame);
  }

  stop() {
    this.isRunning = false;
    this.running = false;
    this.paused = true;
    if (this.threeEngine) {
      this.threeEngine.setActive(false);
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearCanvas();
  }

  pause() {
    this.stop();
  }

  resume() {
    this.start();
  }
}

window.VisualEngine = VisualEngine;
