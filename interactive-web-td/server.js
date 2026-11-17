const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const { exec } = require('child_process');
const WebSocket = require('ws');

const PORT = 3000;
const WS_PORT = 8080;
const UDP_PORTS = [8080, 9000];
const TD_PORT = 9981;
const TD_HOST = 'http://127.0.0.1:' + TD_PORT;
const TOX_PATH = path.resolve(__dirname, '../mcp_webserver_base.tox');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to make HTTP requests to TouchDesigner API
function requestTD(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, TD_HOST);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout connecting to TouchDesigner'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Global settings
let streamQuality = 'performance'; // 'performance' (640x360), 'balanced' (854x480), 'hd' (1280x720)
let streamClients = new Set();
let isStreamingLoopRunning = false;
let latestFrameBuffer = null;
let currentFps = 0;
let frameCounter = 0;
let lastFpsTime = Date.now();
let activeMediaSource = 'Count.mov (Video)';

// Setup resolutionTOP in TouchDesigner for streaming
async function setupStreamTOP(width = 640, height = 360) {
  const script = `
import os
g = op('/generative')
if not g:
    g = root.create(baseCOMP, 'generative')

# Ensure frame_exporter (executeDAT) is active
ex = g.op('frame_exporter')
if not ex:
    ex = g.create(executeDAT, 'frame_exporter')
    ex.par.frameend = 1
    ex.text = """import os
_c = 0
def onFrameEnd(frame):
    global _c
    _c += 1
    if _c % 2 != 0: return
    g = op('/generative')
    if not g or not g.fetch('stream_active', True): return
    s = g.op('stream_out')
    if s:
        try:
            tmp = '/tmp/td_stream.tmp.jpg'
            target = '/tmp/td_stream.jpg'
            s.save(tmp)
            os.replace(tmp, target)
        except Exception: pass
"""
g.store('stream_active', True)

s = g.op('stream_out')
if not s:
    s = g.create(resolutionTOP, 'stream_out')
    out1 = g.op('out1')
    if out1:
        s.inputConnectors[0].connect(out1)
s.par.outputresolution = 'custom'
s.par.resolutionw = ${width}
s.par.resolutionh = ${height}
s.cook(force=True)
result = True
`;
  try {
    await requestTD('/api/td/server/exec', 'POST', { script });
  } catch (e) {}
}

// Background MJPEG Stream Loop (Direct high-speed atomic frame buffer from TouchDesigner)
async function runStreamLoop() {
  if (isStreamingLoopRunning) return;
  isStreamingLoopRunning = true;

  // Signal TouchDesigner to activate frame export
  try {
    await requestTD('/api/td/server/exec', 'POST', {
      script: "op('/generative').store('stream_active', True) if op('/generative') else None"
    });
  } catch (e) {}

  let lastMtime = 0;
  const framePath = '/tmp/td_stream.jpg';

  while (streamClients.size > 0) {
    const t0 = Date.now();
    try {
      if (fs.existsSync(framePath)) {
        const stats = fs.statSync(framePath);
        if (stats.mtimeMs !== lastMtime || !latestFrameBuffer) {
          lastMtime = stats.mtimeMs;
          latestFrameBuffer = fs.readFileSync(framePath);
          frameCounter++;
        }

        if (latestFrameBuffer) {
          for (const clientRes of streamClients) {
            try {
              clientRes.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latestFrameBuffer.length}\r\n\r\n`);
              clientRes.write(latestFrameBuffer);
              clientRes.write('\r\n');
            } catch (e) {
              streamClients.delete(clientRes);
            }
          }
        }

        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
          currentFps = frameCounter;
          frameCounter = 0;
          lastFpsTime = now;
        }
      }
    } catch (err) {}

    const elapsed = Date.now() - t0;
    // 30 FPS target (33ms) for smooth playback with minimal CPU usage
    const targetInterval = streamQuality === 'performance' ? 33 : (streamQuality === 'balanced' ? 40 : 50);
    const sleepTime = Math.max(5, targetInterval - elapsed);
    await new Promise(r => setTimeout(r, sleepTime));
  }

  // When all clients disconnect, deactivate frame export to save CPU
  try {
    await requestTD('/api/td/server/exec', 'POST', {
      script: "op('/generative').store('stream_active', False) if op('/generative') else None"
    });
  } catch (e) {}

  isStreamingLoopRunning = false;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- MJPEG Video Stream ---
  if (pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache'
    });

    streamClients.add(res);
    req.on('close', () => {
      streamClients.delete(res);
    });

    runStreamLoop();
    return;
  }

  // --- API: Status & Telemetry ---
  if (pathname === '/api/status' && req.method === 'GET') {
    try {
      const tdInfo = await requestTD('/api/td/server/td', 'GET');
      const isHealthy = tdInfo && tdInfo.success;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        connected: isHealthy,
        details: tdInfo ? tdInfo.data : null,
        streamFps: currentFps,
        quality: streamQuality,
        activeMedia: activeMediaSource
      }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        connected: false,
        error: 'TouchDesigner not reachable',
        streamFps: 0,
        activeMedia: activeMediaSource
      }));
    }
    return;
  }

  // --- API: Upload User Image or Video ---
  if (pathname === '/api/upload' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    req.on('end', async () => {
      try {
        const rawBuffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        let rawFileName = req.headers['x-file-name'] || parsedUrl.searchParams.get('filename') || '';
        let fileBuffer = rawBuffer;

        if (contentType.includes('multipart/form-data')) {
          const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
          if (boundaryMatch) {
            const boundary = '--' + (boundaryMatch[1] || boundaryMatch[2]).trim();
            const headerEndIdx = rawBuffer.indexOf(Buffer.from('\r\n\r\n'));
            if (headerEndIdx !== -1) {
              const partHeader = rawBuffer.slice(0, headerEndIdx).toString('utf8');
              const fnMatch = partHeader.match(/filename="([^"]+)"/i);
              if (fnMatch && fnMatch[1]) {
                rawFileName = fnMatch[1];
              }
              const bodyStart = headerEndIdx + 4;
              const closingBoundary = Buffer.from('\r\n' + boundary);
              const bodyEnd = rawBuffer.indexOf(closingBoundary, bodyStart);
              fileBuffer = bodyEnd !== -1
                ? rawBuffer.slice(bodyStart, bodyEnd)
                : rawBuffer.slice(bodyStart);
            }
          }
        } else if (contentType.includes('application/json') || (rawBuffer.length > 0 && rawBuffer[0] === 0x7b)) {
          try {
            const jsonBody = JSON.parse(rawBuffer.toString('utf8'));
            rawFileName = jsonBody.filename || jsonBody.fileName || jsonBody.name || rawFileName;
            const rawData = jsonBody.data || jsonBody.source || jsonBody.base64 || jsonBody.content || '';
            if (typeof rawData === 'string' && rawData.length > 0) {
              const base64Match = rawData.match(/^data:([^;]+);base64,(.+)$/);
              if (base64Match) {
                fileBuffer = Buffer.from(base64Match[2], 'base64');
                if (!rawFileName) {
                  const extFromMime = (base64Match[1].split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
                  rawFileName = `media_${Date.now()}.${extFromMime}`;
                }
              } else {
                fileBuffer = Buffer.from(rawData, 'base64');
              }
            }
          } catch (_) {}
        } else if (rawBuffer.slice(0, 5).toString('utf8') === 'data:') {
          const strData = rawBuffer.toString('utf8');
          const base64Match = strData.match(/^data:([^;]+);base64,(.+)$/);
          if (base64Match) {
            fileBuffer = Buffer.from(base64Match[2], 'base64');
            if (!rawFileName) {
              const extFromMime = (base64Match[1].split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
              rawFileName = `media_${Date.now()}.${extFromMime}`;
            }
          }
        }

        if (!rawFileName) {
          rawFileName = `media_${Date.now()}.png`;
        }
        try {
          rawFileName = decodeURIComponent(rawFileName);
        } catch (_) {}
        const filename = `${Date.now()}_${path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const absolutePath = path.resolve(UPLOADS_DIR, filename);
        const publicPath = `/uploads/${filename}`;

        fs.writeFileSync(absolutePath, fileBuffer);
        const activateUpload = parsedUrl.searchParams.get('activate') !== 'false'
          && req.headers['x-upload-activate'] !== 'false';
        if (activateUpload) {
          activeMediaSource = filename;
        }

        const ext = path.extname(filename).toLowerCase();
        const isVideo = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'].includes(ext);
        const mediaType = isVideo ? 'video' : 'image';

        if (activateUpload) {
          // Broadcast td_media packet immediately to all connected WebSocket clients
          broadcastToWs({
            type: 'td_media',
            source: publicPath,
            mediaType: mediaType,
            absolutePath: absolutePath,
            mode: 'media'
          });

          // Also notify TouchDesigner via HTTP API if available
          const script = `
g = op('/generative')
if g:
    m = g.op('media_in')
    if m:
        m.par.file = ${JSON.stringify(absolutePath)}
        m.par.reloadpulse.pulse()
        m.par.play = 1
        m.cook(force=True)
result = True
`;
          requestTD('/api/td/server/exec', 'POST', { script }).catch(() => {});
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          filename: filename,
          fileName: filename,
          url: publicPath,
          path: publicPath,
          publicPath: publicPath,
          source: publicPath,
          filePath: absolutePath,
          absolutePath: absolutePath,
          mediaType: mediaType
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API: Load Media Preset ---
  if (pathname === '/api/media-preset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { preset } = JSON.parse(body);
        let sampleFile = 'Count.mov';
        let label = 'Count Video (Demo)';

        if (preset === 'butterfly') {
          sampleFile = 'Butterfly1.tif';
          label = 'Mariposa (Imagen)';
        } else if (preset === 'ocean') {
          sampleFile = 'CloudyOcean_2Kx1K_8bit.tif';
          label = 'Océano Cósmico (Imagen)';
        } else if (preset === 'jellybeans') {
          sampleFile = 'Jellybeans.1.jpg';
          label = 'Jellybeans Pop (Imagen)';
        } else if (preset === 'oildrums') {
          sampleFile = 'OilDrums.jpg';
          label = 'Oil Drums (Imagen)';
        } else if (preset === 'trillium' || preset === 'nature') {
          sampleFile = 'Starfish.tif';
          label = 'Estrella de Mar (Imagen)';
        }

        activeMediaSource = label;
        const script = `
import os
samples = os.path.join(app.samplesFolder, 'Map')
filePath = os.path.join(samples, '${sampleFile}')
g = op('/generative')
if g:
    m = g.op('media_in')
    if m:
        m.par.file = filePath
        m.par.reloadpulse.pulse()
        m.par.play = 1
        m.cook(force=True)
result = filePath
`;
        await requestTD('/api/td/server/exec', 'POST', { script });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, label, path: sampleFile }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API: Set Stream Quality ---
  if (pathname === '/api/quality' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { quality } = JSON.parse(body);
        streamQuality = quality;
        let w = 640, h = 360;
        if (quality === 'balanced') { w = 854; h = 480; }
        if (quality === 'hd') { w = 1280; h = 720; }
        await setupStreamTOP(w, h);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, quality, width: w, height: h }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API: Update Creative Visual FX Parameters ---
  if (pathname === '/api/params' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const p = JSON.parse(body);
        const script = `
g = op('/generative')
if g:
    media = g.op('media_in')
    noise = g.op('noise_mod')
    displace = g.op('displace1')
    mirror = g.op('mirror1')
    trans = g.op('transform1')
    edge = g.op('edge1')
    hsv = g.op('hsv1')
    comp = g.op('composite1')
    level = g.op('level1')

    # 1. Subtle Liquid Displace Controls
    if displace:
        if 'displace' in ${JSON.stringify(p)}:
            d = float(${JSON.stringify(p.displace ?? 0.0)})
            displace.par.displaceweightx = d * 0.1
            displace.par.displaceweighty = d * 0.1

    # 2. Noise Modulator Controls
    if noise:
        if 'speed' in ${JSON.stringify(p)}:
            noise.par.tx.expr = 'absTime.seconds * ' + str(${JSON.stringify(p.speed ?? 0.08)})
        if 'period' in ${JSON.stringify(p)}:
            noise.par.period = float(${JSON.stringify(p.period ?? 3.5)})
        if 'roughness' in ${JSON.stringify(p)}:
            noise.par.rough = float(${JSON.stringify(p.roughness ?? 0.3)})
        if 'x' in ${JSON.stringify(p)}:
            noise.par.px = float(${JSON.stringify(p.x ?? 0)}) * 0.5
        if 'y' in ${JSON.stringify(p)}:
            noise.par.py = float(${JSON.stringify(p.y ?? 0)}) * 0.5

    # 3. Symmetry & Mirror
    if mirror:
        if 'mirrorAngle' in ${JSON.stringify(p)}:
            mirror.par.rotate = float(${JSON.stringify(p.mirrorAngle ?? 0)})
        if 'flipX' in ${JSON.stringify(p)}:
            mirror.par.flipx = 1 if ${JSON.stringify(p.flipX ?? false)} else 0
        if 'flipY' in ${JSON.stringify(p)}:
            mirror.par.flipy = 1 if ${JSON.stringify(p.flipY ?? false)} else 0

    # 4. Zoom & Scale
    if trans:
        if 'rotate' in ${JSON.stringify(p)}:
            trans.par.rotate = float(${JSON.stringify(p.rotate ?? 0)})
        if 'scale' in ${JSON.stringify(p)}:
            s = float(${JSON.stringify(p.scale ?? 1.0)})
            trans.par.sx = s
            trans.par.sy = s

    # 5. Luminous Neon Outline
    edge_level = g.op('edge_level')
    if edge_level and 'edgeStrength' in ${JSON.stringify(p)}:
        edge_level.par.opacity = min(1.0, float(${JSON.stringify(p.edgeStrength ?? 0.0)}) * 0.8)

    if comp and 'blendMode' in ${JSON.stringify(p)}:
        comp.par.operand = str(${JSON.stringify(p.blendMode ?? 'screen')})

    # 6. Color Shift & Hue
    if hsv and 'hue' in ${JSON.stringify(p)}:
        hsv.par.hueoffset = float(${JSON.stringify(p.hue ?? 0)})

    if level and 'contrast' in ${JSON.stringify(p)}:
        level.par.contrast = float(${JSON.stringify(p.contrast ?? 1.05)})

    out = g.op('stream_out') or g.op('out1')
    if out:
        out.cook(force=True)
result = True
`;
        const resp = await requestTD('/api/td/server/exec', 'POST', { script });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result: resp }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // --- API: Launch TD in Background ---
  if (pathname === '/api/launch' && req.method === 'POST') {
    const cmd = `open -j -g -a TouchDesigner "${TOX_PATH}"`;
    exec(cmd, (err) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'TouchDesigner lanzado en segundo plano.' }));
    });
    return;
  }

  // --- API: Single Frame Snapshot ---
  if (pathname === '/api/frame' && (req.method === 'GET' || req.method === 'HEAD')) {
    if (latestFrameBuffer) {
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': latestFrameBuffer.length,
        'Cache-Control': 'no-store, no-cache'
      });
      res.end(latestFrameBuffer);
      return;
    }

    // On-demand capture if no active stream buffer yet
    const captureScript = `
import base64
s = op('/generative/stream_out') or op('/generative/out1') or root.findChildren(type=nullTOP)[0] if root.findChildren(type=nullTOP) else None
if s:
    ba = s.saveByteArray('.jpg')
    result = base64.b64encode(bytes(ba)).decode('ascii')
else:
    result = None
`;
    try {
      const resp = await requestTD('/api/td/server/exec', 'POST', { script: captureScript });
      if (resp && resp.data && resp.data.result) {
        latestFrameBuffer = Buffer.from(resp.data.result, 'base64');
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': latestFrameBuffer.length,
          'Cache-Control': 'no-store, no-cache'
        });
        res.end(latestFrameBuffer);
        return;
      }
    } catch (e) {}

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No frame available' }));
    return;
  }

  // --- Helper for External HTTPS JSON Requests (Weather & Video Cloud APIs) ---
  function fetchHttpsJson(urlString, customHeaders = {}, timeoutMs = 4200) {
    return new Promise((resolve, reject) => {
      try {
        const u = new URL(urlString);
        const reqOpts = {
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: 'GET',
          headers: {
            'User-Agent': 'VortexStudio/2.0 (Token-Auth-Client)',
            'Accept': 'application/json',
            ...customHeaders
          },
          timeout: timeoutMs
        };
        const httpsReq = https.request(reqOpts, (httpsRes) => {
          let raw = '';
          httpsRes.on('data', (chunk) => { raw += chunk; });
          httpsRes.on('end', () => {
            if (httpsRes.statusCode >= 200 && httpsRes.statusCode < 300) {
              try {
                resolve(JSON.parse(raw));
              } catch (parseErr) {
                reject(new Error(`Invalid JSON (${httpsRes.statusCode})`));
              }
            } else {
              reject(new Error(`HTTP ${httpsRes.statusCode}: ${raw.slice(0, 120)}`));
            }
          });
        });
        httpsReq.on('error', reject);
        httpsReq.on('timeout', () => {
          httpsReq.destroy();
          reject(new Error('HTTPS request timeout'));
        });
        httpsReq.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // --- API 1: Real-Time Weather -> Visuals (GET /api/weather?city=Puebla&token=VALOR_TOKEN) ---
  if (pathname === '/api/weather' && req.method === 'GET') {
    const city = (parsedUrl.searchParams.get('city') || 'Puebla').trim();
    const rawHeaderAuth = req.headers['authorization'] ? String(req.headers['authorization']).replace(/^Bearer\s+/i, '').trim() : '';
    const rawToken = (parsedUrl.searchParams.get('token') || rawHeaderAuth || process.env.OPENWEATHER_API_KEY || '').trim();
    const maskedToken = rawToken
      ? (rawToken.length > 8 ? `${rawToken.slice(0, 4)}...${rawToken.slice(-4)}` : rawToken)
      : 'demo-token-fallback';

    console.log(`[API WEATHER] Solicitud Clima para "${city}" | tokenUsed="${maskedToken}"`);

    // 1. Primary official request to OpenWeatherMap API passing appid=${token}
    if (rawToken && rawToken.length >= 8) {
      try {
        const owmUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(rawToken)}&units=metric&lang=es`;
        const owm = await fetchHttpsJson(owmUrl);
        if (owm && owm.main) {
          const payload = {
            ok: true,
            city: owm.name || city,
            temp: Math.round(Number(owm.main.temp) * 10) / 10,
            humidity: Number(owm.main.humidity) || 50,
            wind: Math.round((Number(owm.wind && owm.wind.speed) || 0) * 3.6 * 10) / 10, // km/h
            condition: (owm.weather && owm.weather[0] && owm.weather[0].description) || 'Despejado',
            weatherMain: (owm.weather && owm.weather[0] && owm.weather[0].main) || '',
            weatherRaw: owm.weather || [],
            source: 'OpenWeatherMap API (Official Token)',
            tokenUsed: maskedToken
          };
          console.log(`[API WEATHER] OpenWeatherMap OK:`, payload);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
          return;
        }
      } catch (owmErr) {
        console.warn(`[API WEATHER] OpenWeather (${owmErr.message}) -> activando fallback transparente wttr.in...`);
      }
    }

    // 2. Transparent real-data fallback via wttr.in JSON API
    try {
      const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const wttr = await fetchHttpsJson(wttrUrl, {}, 4000);
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

        const payload = {
          ok: true,
          city,
          temp: Number(cur.temp_C) || 22,
          humidity: Number(cur.humidity) || 48,
          wind: Number(cur.windspeedKmph) || 12,
          condition: descEs,
          weatherMain: wMain,
          source: rawToken ? 'wttr.in Live (Token Fallback)' : 'wttr.in Live Telemetry',
          tokenUsed: maskedToken
        };
        console.log(`[API WEATHER] wttr.in OK:`, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
    } catch (wttrErr) {
      console.warn(`[API WEATHER] wttr.in (${wttrErr.message}) -> usando telemetría climática local.`);
    }

    // 3. Offline-resilient fallback so exam demo never fails even without internet
    const cityPresets = {
      puebla: { temp: 24, wind: 14, humidity: 45, condition: 'Cielo despejado solar', weatherMain: 'Clear' },
      cdmx: { temp: 21, wind: 11, humidity: 52, condition: 'Nubosidad dispersa', weatherMain: 'Clouds' },
      monterrey: { temp: 31, wind: 22, humidity: 34, condition: 'Cálido despejado', weatherMain: 'Clear' },
      tokio: { temp: 13, wind: 19, humidity: 76, condition: 'Lluvia ligera neón', weatherMain: 'Rain' },
      reykjavik: { temp: 2, wind: 28, humidity: 84, condition: 'Frío polar y niebla', weatherMain: 'Fog' }
    };
    const key = city.toLowerCase();
    const preset = cityPresets[key] || { temp: 23, wind: 15, humidity: 50, condition: 'Brisa templada' };
    const fallbackPayload = {
      ok: true,
      city,
      ...preset,
      source: 'Local Weather Telemetry (Fallback)',
      tokenUsed: maskedToken
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fallbackPayload));
    return;
  }

  // --- API 2: Cloud Video Search via GIPHY MP4 (GET /api/videos?q=QUERY&token=VALOR_TOKEN) ---
  if (pathname === '/api/videos' && req.method === 'GET') {
    const query = (parsedUrl.searchParams.get('q') || 'cyberpunk').trim();
    const rawHeaderAuth = req.headers['authorization'] ? String(req.headers['authorization']).replace(/^Bearer\s+/i, '').trim() : '';
    const rawToken = (parsedUrl.searchParams.get('token') || rawHeaderAuth || process.env.GIPHY_API_KEY || '').trim();
    const maskedToken = rawToken
      ? (rawToken.length > 8 ? `${rawToken.slice(0, 4)}...${rawToken.slice(-4)}` : rawToken)
      : 'giphy-public-key';

    console.log(`[API VIDEOS] GIPHY Search="${query}" | Bearer Token="${maskedToken}"`);

    const PUBLIC_GIPHY_KEY = 'dc6zaTOxFJmzC';
    const giphyKey = rawToken || process.env.GIPHY_API_KEY || PUBLIC_GIPHY_KEY;

    let responseStatus = 200;
    res.status = (code) => {
      responseStatus = code;
      return res;
    };
    res.json = (payload) => {
      res.writeHead(responseStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return res;
    };

    const q = query;
    try {
      const giphyUrl = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(q)}&limit=8&lang=es`;
      const response = await fetch(giphyUrl);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !data.data || !Array.isArray(data.data)) {
        console.error("GIPHY API Error:", data);
        return res.status(400).json({ error: "Llave de GIPHY inválida o inactiva. Verifica tu API Key." });
      }

      const videos = data.data.map(item => {
        return item.images?.original?.mp4 || item.images?.original_mp4?.mp4 || null;
      }).filter(url => url !== null);

      console.log(`[API VIDEOS] GIPHY OK (${videos.length} clips MP4) | Bearer Token="${maskedToken}"`);
      res.json({ videos });
      return;
    } catch (giphyErr) {
      console.warn(`[API VIDEOS] GIPHY con key ${giphyKey.slice(0, 4)}*** (${giphyErr.message})`);
    }

    // 2. Live key-less fallback when GIPHY legacy key returns 403 (Wikimedia Commons Video Search + Imgflip Memes)
    const qLower = query.toLowerCase();
    try {
      const wantMemes = /\b(meme|memes|funny|gracioso|lol|doge|cat|gato)\b/i.test(qLower);
      if (wantMemes) {
        const imgflip = await fetchHttpsJson('https://api.imgflip.com/get_memes', {}, 4000);
        if (imgflip && imgflip.success && imgflip.data && Array.isArray(imgflip.data.memes)) {
          const filtered = imgflip.data.memes.filter(m =>
            !qLower || qLower === 'meme' || qLower === 'memes' || m.name.toLowerCase().includes(qLower)
          );
          const picks = (filtered.length > 0 ? filtered : imgflip.data.memes).slice(0, 6).map((m, idx) => ({
            id: `meme_${m.id || idx}`,
            title: `😂 ${m.name}`,
            url: m.url,
            thumb: m.url,
            mediaType: 'image',
            duration: 10,
            theme: 'meme'
          }));
          if (picks.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              ok: true,
              query,
              source: 'Imgflip Live Memes API (CORS-Free)',
              tokenUsed: maskedToken,
              videos: picks
            }));
            return;
          }
        }
      }

      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:video')}&gsrnamespace=6&gsrlimit=6&prop=videoinfo&viprop=url|derivatives|thumburl&viurlwidth=320&format=json`;
      const wikiData = await fetchHttpsJson(wikiUrl, {}, 4500);
      const pages = Object.values((wikiData && wikiData.query && wikiData.query.pages) || {});
      const wikiVideos = pages
        .map((p, idx) => {
          const vi = p.videoinfo && p.videoinfo[0];
          if (!vi) return null;
          const derivs = Array.isArray(vi.derivatives) ? vi.derivatives : [];
          const bestDeriv =
            derivs.find(d => /\.mp4|\.mov/i.test(String(d.src || ''))) ||
            derivs.find(d => /360p|480p|240p/i.test(String(d.src || '')) && /\.webm/i.test(String(d.src || ''))) ||
            derivs[0];
          const playUrl = (bestDeriv && bestDeriv.src) || vi.url || '';
          if (!playUrl) return null;
          const cleanTitle = String(p.title || `Clip ${idx + 1}`).replace(/^File:/i, '').replace(/\.[^.]+$/, '').slice(0, 34);
          return {
            id: `wiki_${p.pageid || idx}`,
            title: `🎬 ${cleanTitle}`,
            url: playUrl,
            thumb: vi.thumburl || 'media/thumbs/tunnel.svg',
            duration: 12,
            theme: qLower
          };
        })
        .filter(Boolean);

      if (wikiVideos.length > 0) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          query,
          source: 'Wikimedia Live Video API (CORS-Free)',
          tokenUsed: maskedToken,
          videos: wikiVideos
        }));
        return;
      }
    } catch (liveFallbackErr) {
      console.warn(`[API VIDEOS] Live fallback (${liveFallbackErr.message}) -> catálogo local.`);
    }

    // 3. Offline-resilient fallback if no internet access
    const fallbackCatalog = [
      {
        id: 'api_vid_galaxy',
        title: '🌌 Deep Galaxy & Nebula Clip',
        keywords: ['galaxy', 'space', 'cosmos', 'nebula', 'stars', 'espacio', 'galaxia'],
        url: '',
        thumb: 'media/thumbs/tunnel.svg',
        duration: 15,
        theme: 'galaxy'
      },
      {
        id: 'api_vid_ocean',
        title: '🪼 Bioluminescent Jellyfish',
        keywords: ['ocean', 'jellyfish', 'water', 'sea', 'aqua', 'medusas', 'oceano', 'mar'],
        url: '',
        thumb: 'media/thumbs/ocean.svg',
        duration: 18,
        theme: 'ocean'
      },
      {
        id: 'api_vid_neon',
        title: '⚡ Cyber Neon Glitch Loop',
        keywords: ['neon', 'cyber', 'particles', 'city', 'synthwave', 'glitch', 'anime', 'meme'],
        url: '',
        thumb: 'media/thumbs/city.svg',
        duration: 14,
        theme: 'neon'
      },
      {
        id: 'api_vid_tunnel',
        title: '🌀 Hyperspace Vortex Tunnel',
        keywords: ['tunnel', 'vortex', 'abstract', 'fractal', 'portal', 'tunel'],
        url: '',
        thumb: 'media/thumbs/dancer.svg',
        duration: 16,
        theme: 'tunnel'
      }
    ];

    const sorted = [...fallbackCatalog].sort((a, b) => {
      const aMatch = a.keywords.some(k => qLower.includes(k) || k.includes(qLower)) ? 1 : 0;
      const bMatch = b.keywords.some(k => qLower.includes(k) || k.includes(qLower)) ? 1 : 0;
      return bMatch - aMatch;
    }).map((item, idx) => ({
      ...item,
      id: `${item.id}_${Date.now().toString(36).slice(-4)}_${idx}`,
      title: idx === 0 && qLower ? `${item.title} [${query}]` : item.title
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      query,
      source: 'GIPHY Offline Fallback Catalog',
      tokenUsed: maskedToken,
      videos: sorted
    }));
    return;
  }

  // --- Static Files & Uploaded Media ---
  let safePathname = pathname;
  try {
    safePathname = decodeURIComponent(pathname);
  } catch (_) {}
  let filePath = safePathname.startsWith('/uploads/')
    ? path.resolve(__dirname, safePathname.replace(/^\/+/, ''))
    : path.join(__dirname, 'public', safePathname === '/' ? 'index.html' : safePathname);
  if (safePathname.startsWith('/uploads/') && !filePath.startsWith(UPLOADS_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? '404 Not Found' : '500 Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    }
  });
});

// --- WebSocket Bridges & Purr Data UDP (dgram) Receiver ---
// 1. Attached to Main Server (Port 3000 at /ws)
const wss = new WebSocket.Server({ server, path: '/ws' });
const wssMain = wss;
const allWsClients = new Set();

function broadcastToWs(payload) {
  const msgStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  allWsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(msgStr); } catch (e) {}
    }
  });
}

function resolveTdMediaPath(data) {
  const rawSource = typeof data.source === 'string' ? data.source.trim() : '';

  // c) Si data.source viene en formato data:image/...;base64 (o data:...;base64) o blob
  if (rawSource.startsWith('data:') || rawSource.startsWith('blob:') || data.base64) {
    const dataUri = rawSource.startsWith('data:') ? rawSource : (typeof data.base64 === 'string' ? data.base64 : '');
    const base64Match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (base64Match) {
      const mime = base64Match[1].toLowerCase();
      let ext = '.png';
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else if (mime.includes('png')) ext = '.png';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('gif')) ext = '.gif';
      else if (mime.includes('mp4')) ext = '.mp4';
      else if (mime.includes('quicktime') || mime.includes('mov')) ext = '.mov';
      else if (mime.includes('webm')) ext = '.webm';

      const filename = data.filename || data.fileName
        ? `${Date.now()}_${path.basename(data.filename || data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`
        : `media_${Date.now()}${ext}`;
      const savedPath = path.resolve(__dirname, 'uploads', filename);
      fs.writeFileSync(savedPath, Buffer.from(base64Match[2], 'base64'));
      return savedPath;
    }

    if (dataUri && !dataUri.startsWith('blob:')) {
      const filename = data.filename || data.fileName
        ? `${Date.now()}_${path.basename(data.filename || data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`
        : `media_${Date.now()}.png`;
      const savedPath = path.resolve(__dirname, 'uploads', filename);
      fs.writeFileSync(savedPath, Buffer.from(dataUri, 'base64'));
      return savedPath;
    }

    // Fallback para URLs blob: asociadas a archivos subidos en uploads/
    if (data.filename || data.fileName) {
      const safeName = path.basename(data.filename || data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const directCandidate = path.resolve(__dirname, 'uploads', safeName);
      if (fs.existsSync(directCandidate)) return directCandidate;
    }
    try {
      const files = fs.readdirSync(UPLOADS_DIR)
        .map(f => ({ name: f, time: fs.statSync(path.resolve(__dirname, 'uploads', f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);
      if (files.length > 0) {
        return path.resolve(__dirname, 'uploads', files[0].name);
      }
    } catch (_) {}
    const fallbackFilename = `blob_${Date.now()}.png`;
    return path.resolve(__dirname, 'uploads', fallbackFilename);
  }

  let cleanSource = rawSource;
  if (/^https?:\/\//i.test(cleanSource)) {
    try {
      cleanSource = new URL(cleanSource).pathname;
    } catch (_) {}
  }

  // b) Si data.source apunta a un archivo subido en /uploads/...
  if (cleanSource.startsWith('/uploads/') || cleanSource.startsWith('uploads/')) {
    return path.resolve(__dirname, cleanSource.replace(/^\//, ''));
  }

  // a) Si data.source apunta a una imagen de la galería precargada (ej. media/flowers.jpg, media/city.jpg, etc.)
  return path.resolve(__dirname, 'public', cleanSource.replace(/^\//, ''));
}

let lastBioValue = 0.0;
function dispatchBioData(rawVal, cc = null, source = 'udp') {
  let val = parseFloat(rawVal);
  if (Number.isNaN(val)) return;
  // Normalize if incoming is raw integer ADC (e.g. 0..127 MIDI, 0..1023 Arduino, 0..4095 ESP32)
  if (val > 1.0) {
    if (val <= 127.0 && cc !== null) val = val / 127.0;
    else if (val <= 1023.0) val = val / 1023.0;
    else if (val <= 4095.0) val = val / 4095.0;
    else val = 1.0;
  }
  val = Math.max(0.0, Math.min(1.0, val));
  const delta = val - lastBioValue;
  lastBioValue = val;
  broadcastToWs({
    type: 'bio_data',
    value: val,
    delta: delta,
    cc: cc,
    source: source
  });
}

// Parse FUDI messages sent by Purr Data [netsend -u]
// Expected formats:
//   - "note <pitch> <velocity>;" or "send note <pitch> <velocity>;"
//   - "<valor_normalizado> <numero_cc>;" or "send <valor_normalizado> <numero_cc>;"
//   - "bio <valor>;" or "send bio <valor>;" (ESP32 bio-signal)
function handleUdpFudiPacket(msgBuffer, rinfo, port) {
  const text = msgBuffer.toString('utf8');
  const statements = text.split(/[;\r\n]+/);

  for (const rawStmt of statements) {
    const trimmed = rawStmt.trim();
    if (!trimmed) continue;

    // Strip optional FUDI selector ("send" or "list") if present
    const cleaned = trimmed.replace(/^(send|list)\s+/i, '').trim();
    const parts = cleaned.split(/\s+/);

    if (parts.length >= 2 && (parts[0].toLowerCase() === 'bio' || parts[0].toLowerCase() === 'bio_data')) {
      dispatchBioData(parts[1], null, 'udp_bio');
      continue;
    }

    if (parts.length >= 2 && parts[0].toLowerCase() === 'note') {
      const note = parseInt(parts[1], 10);
      const velocity = parts.length >= 3 ? parseInt(parts[2], 10) : 127;
      if (!Number.isNaN(note) && !Number.isNaN(velocity)) {
        broadcastToWs({
          type: 'midi_note',
          note,
          velocity
        });
      }
      continue;
    }

    if (parts.length >= 2) {
      const rawVal = parseFloat(parts[0]);
      const rawCc = parseInt(parts[1], 10);

      if (!Number.isNaN(rawVal) && !Number.isNaN(rawCc)) {
        const value = Math.max(0.0, Math.min(1.0, Number(rawVal)));
        const cc = Number(rawCc);
        broadcastToWs({
          type: 'midi_cc',
          cc: cc,
          value: value
        });
        // Retransmit bio_data for ESP32 bio-sensors using standard CC 14..17 and Purr Data CC 80
        if ([14, 15, 16, 17, 80].includes(cc)) {
          dispatchBioData(value, cc, 'udp_cc');
        }
      }
    }
  }
}

// Bind UDP sockets on 8080 (primary) and 9000 (backup) for Purr Data [netsend -u]
UDP_PORTS.forEach((udpPort) => {
  try {
    const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    udpSocket.on('error', (err) => {
      console.warn(`[UDP Bridge] Error en puerto UDP ${udpPort}:`, err.message);
    });

    udpSocket.on('message', (msg, rinfo) => {
      handleUdpFudiPacket(msg, rinfo, udpPort);
    });

    udpSocket.on('listening', () => {
      const addr = udpSocket.address();
      console.log(`🎹 [UDP Purr Data] Escuchando FUDI [netsend -u] en udp://${addr.address}:${addr.port}`);
    });

    udpSocket.bind(udpPort, '0.0.0.0');
  } catch (err) {
    console.warn(`[UDP Bridge] No se pudo iniciar UDP en puerto ${udpPort}:`, err.message);
  }
});

function setupWsBroadcaster(serverInstance, label) {
  serverInstance.on('connection', (ws) => {
    allWsClients.add(ws);

    try {
      ws.send(JSON.stringify({
        type: 'udp_bridge_ready',
        udpPorts: UDP_PORTS
      }));
    } catch (e) {}

    ws.on('message', (rawMsg) => {
      const msgStr = rawMsg.toString();
      let data = null;
      try {
        data = JSON.parse(msgStr);
      } catch (e) {}

      if (data && data.type === 'td_media') {
        const rutaAbsolutaResuelta = resolveTdMediaPath(data);
        const packet = {
          type: 'td_media',
          source: data.source,
          mediaType: data.mediaType || 'image',
          absolutePath: rutaAbsolutaResuelta,
          mode: data.mode || 'media'
        };
        broadcastToWs(packet);
        return;
      }

      // Broadcast any other message to all other connected clients
      allWsClients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          try { client.send(msgStr); } catch (e) {}
        }
      });
    });

    ws.on('close', () => allWsClients.delete(ws));
    ws.on('error', () => allWsClients.delete(ws));
  });
}

setupWsBroadcaster(wssMain, 'Port 3000 (/ws)');

// 2. Standalone WebSocket on TCP Port 8080
let wss8080 = null;
try {
  wss8080 = new WebSocket.Server({ port: WS_PORT });
  setupWsBroadcaster(wss8080, 'Port 8080');
} catch (e) {
  console.warn(`[WS Bridge] Note: TCP Port ${WS_PORT} unavailable, /ws on port 3000 active.`);
}

// 3. DAW MIDI Bridge (Virtual Port "VORTEX Show Sync" + IAC Driver / Pro Tools inputs)
function setupDawMidiBridge() {
  try {
    const midi = require('@julusian/midi');
    const openInputs = [];

    const handleDawMidiMessage = (portLabel) => (_deltaTime, message) => {
      if (!Array.isArray(message) || message.length < 3) return;
      const status = message[0] & 0xf0;
      const data1 = message[1];
      const data2 = message[2];

      // Note On (vel > 0) for notes 36..43 -> trigger Show Cues 1..8 (CC 21..28)
      if (status === 0x90 && data2 > 0 && data1 >= 36 && data1 <= 43) {
        const cueIndex = data1 - 36;
        broadcastToWs({
          type: 'midi_cc',
          cc: 21 + cueIndex,
          value: 1.0,
          note: data1,
          velocity: data2 / 127.0,
          source: portLabel
        });
        return;
      }

      // Control Change -> forward normalized CC (0.0..1.0)
      if (status === 0xb0) {
        const normalizedVal = data2 / 127.0;
        broadcastToWs({
          type: 'midi_cc',
          cc: data1,
          value: normalizedVal,
          source: portLabel
        });
        if ([14, 15, 16, 17, 80].includes(data1)) {
          dispatchBioData(normalizedVal, data1, portLabel);
        }
      }
    };

    try {
      const virtualIn = new midi.Input();
      virtualIn.ignoreTypes(false, false, false);
      virtualIn.on('message', handleDawMidiMessage('VORTEX Show Sync'));
      virtualIn.openVirtualPort('VORTEX Show Sync');
      openInputs.push(virtualIn);
      console.log('[DAW MIDI] Virtual port ready: "VORTEX Show Sync"');
    } catch (virtErr) {
      console.warn('[DAW MIDI] Could not open virtual port "VORTEX Show Sync":', virtErr.message);
    }

    try {
      const scanner = new midi.Input();
      const count = scanner.getPortCount();
      for (let i = 0; i < count; i++) {
        const portName = scanner.getPortName(i);
        if (/iac\s*driver|pro\s*tools/i.test(portName)) {
          const hwIn = new midi.Input();
          hwIn.ignoreTypes(false, false, false);
          hwIn.on('message', handleDawMidiMessage(portName));
          hwIn.openPort(i);
          openInputs.push(hwIn);
          console.log(`[DAW MIDI] Listening on input: "${portName}"`);
        }
      }
      if (typeof scanner.closePort === 'function') {
        scanner.closePort();
      }
    } catch (scanErr) {
      console.warn('[DAW MIDI] Error scanning MIDI ports:', scanErr.message);
    }
  } catch (err) {
    console.warn('[DAW MIDI] @julusian/midi unavailable, skipping DAW bridge:', err.message);
  }
}

setupDawMidiBridge();

server.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🎨 Vortex Studio — Modular Audiovisual Surface`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🎥 Stream: http://localhost:${PORT}/api/stream`);
  console.log(`🔌 WebSocket Bridge (TCP): ws://localhost:${WS_PORT} & ws://localhost:${PORT}/ws`);
  console.log(`🎹 Purr Data [netsend -u] (UDP): localhost:8080 (y respaldo :9000)`);
  console.log(`📁 Uploads Directory: ${UPLOADS_DIR}`);
  console.log(`====================================================`);
  await setupStreamTOP(640, 360);
});
