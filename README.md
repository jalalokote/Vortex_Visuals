# ⚡ VORTEX STUDIO — Sintetizador Audiovisual Modular & Consola TouchDesigner en Vivo

**VORTEX Studio** es una estación de trabajo audiovisual interactiva en tiempo real que combina un sintetizador visual **WebGL 2D (GLSL)**, un motor de **Mundos 3D interactivos (Three.js)**, análisis de espectro de audio **FFT en vivo**, integración con **APIs en la nube (Clima y Video)**, recepción de **Bio-Señales (ESP32)**, control **MIDI vía Purr Data / DAW** y un modo de **Consola en Vivo para TouchDesigner (TD Custom Deck)**.

---

## 🚀 1. Cómo Iniciar el Proyecto

### Opción A: Lanzador de 1 Clic (macOS)
Haz doble clic en el archivo:
```text
Iniciar_Vortex_Studio.command
```
Esto iniciará automáticamente el servidor local de Node.js y abrirá el navegador en `http://localhost:3000`.

### Opción B: Desde la Terminal
```bash
cd interactive-web-td
node server.js
```
Luego abre en tu navegador: **`http://localhost:3000`**

### Puertos que levanta el servidor (`server.js`)
| Servicio | Puerto / Ruta | Descripción |
| :--- | :--- | :--- |
| **Interfaz Web y APIs REST** | `http://localhost:3000` | Aplicación principal, subida de medios (`/api/upload`), API Clima (`/api/weather`) y API Videos (`/api/videos`). |
| **WebSocket Hub** | `ws://localhost:8080` y `ws://localhost:3000/ws` | Puente bidireccional en tiempo real entre el navegador, Purr Data, ESP32 y TouchDesigner. |
| **Receptor UDP (Purr Data / ESP32)** | `udp://0.0.0.0:8080` (y respaldo `:9000`) | Escucha paquetes UDP en formato FUDI desde `[netsend -u]` de Purr Data o desde un microcontrolador ESP32 por Wi-Fi. |
| **Puente MIDI Virtual (DAW)** | Puerto `"VORTEX Show Sync"` / `IAC Driver` | Puerto MIDI virtual para sincronizar escenas y controles desde Pro Tools, Ableton Live o Logic Pro. |
| **Enlace HTTP TouchDesigner** | `http://127.0.0.1:9981` | Comunicación con el componente MCP / WebServer de TouchDesigner. |

---

## 🖥️ 2. ¿Cómo Funciona la Página y Qué Contiene?

La interfaz está organizada como un **rack modular tipo HUD** sobre el lienzo visual a pantalla completa, dividido en una **Barra Superior** y **6 paneles colapsables**:

### 🔹 Barra Superior (Header HUD)
* **Selector de Motor (`⚡ WebGL` / `🎥 TD`)**:
  * **`⚡ WebGL`**: Ejecuta todos los shaders 2D, mundos 3D y procesamiento de imagen/video directamente en el navegador a 60 FPS sin requerir TouchDesigner abierto.
  * **`🎥 TD`**: Activa el modo **TD Live Controller Deck**, convirtiendo la interfaz en una superficie de control que transmite perillas, botones, medios y FFT a TouchDesigner vía WebSocket y muestra el stream o matriz de señales de 12 canales.
* **Indicador `UDP :8080 (Purr Data)`**: Parpadea en tiempo real cada vez que entra un mensaje MIDI CC, Nota MIDI o Bio-Señal por UDP.
* **Botón `🎹 MIDI Learn`**: Permite mapear cualquier perilla física (MIDI CC) o botón/escena (Nota MIDI) con un solo clic.
* **Puente WebSocket (`ws://localhost:8080` + botón `Bridge`)**: Conecta al Hub local o directamente a un `Web Server DAT` de TouchDesigner.
* **Selector de Tema (`🌙` / `⚡` / `☀️`)**: Cambia entre los temas visuales *Industrial (Oscuro)*, *Cyber (Neón)* y *Claro*.
* **Botón de Emergencia `🔄 Reset` (Atajo: `Shift + R`)**: Descongela y reinicia inmediatamente el motor visual (WebGL, FBOs, cámara 3D, estado `Freeze` y efectos), restaurando las perillas visuales a sus valores limpios **sin detener ni cortar la música que esté sonando**.
* **Pantalla Completa (`⛶` / Tecla `F`)** y **Ocultar/Mostrar HUD (`👁️` / Tecla `H`)**.

---

### 🔹 Panel `[00 · SOURCE]` — Medios, Cámara y API Cloud
Controla la fuente de imagen o video que entra a la cadena de efectos:
1. **`📁 Subir Imagen / Video` y Zona Drag & Drop**: Sube archivos locales (`JPG`, `PNG`, `GIF`, `MP4`, `WEBM`, `MOV`) o arrástralos directamente sobre el lienzo. Los archivos subidos se guardan en la galería y pueden eliminarse individualmente con el botón `×`.
2. **`📷 Cam`**: Activa o desactiva la cámara web en vivo como textura procesada por todos los efectos.
3. **`⏸ Pausa` / `⟲ Loop`**: Controla la reproducción de videos cargados.
4. **Encuadre Media (`X`, `Y`, `Zoom` y `Reset`)**: Permite desplazar y hacer zoom a cualquier foto o video activo sin bordes negros gracias al espejo UV automático.
5. **🌐 API CLOUD (TOKEN AUTH)** *(desplegable)*:
   * **🌤️ API Clima -> Visuales**: Consulta el clima real de cualquier ciudad (ej. *Puebla, CDMX, Monterrey, Tokio, Reykjavik*) usando `GET /api/weather` (con soporte para API Key de OpenWeatherMap, fallback en vivo a `wttr.in` y modo offline). Modula automáticamente la atmósfera del mundo 3D y los shaders según el clima real:
     * *Despejado (`Clear`)*: Cielo limpio, sol/luna nítidos y paleta cálida/infrarroja.
     * *Nublado (`Clouds`)*: Capas de nubes volumétricas 3D desplazándose según la velocidad del viento.
     * *Neblina (`Fog`)*: Niebla atmosférica densa (`FogExp2`).
     * *Lluvia / Tormenta (`Rain` / `Thunderstorm`)*: Lluvia diagonal 3D y relámpagos sincronizados con los golpes del bajo (`BASS`).
     * *Nieve (`Snow`)*: Partículas de nieve polar.
     * Incluye 3 botones de prueba rápida: **`🌧️ Tormenta`**, **`🔥 Calor Solar`** y **`❄️ Nieve/Niebla`**.
   * **🎬 API Clips / Memes MP4 (GIPHY)**: Busca clips MP4/GIFs en tiempo real mediante `GET /api/videos` o permite pegar directamente cualquier URL `.mp4` / `.gif` para cargarla en el lienzo y guardarla en los Cues.

---

### 🔹 Panel `[0A · AUDIO]` — Audio, Reactividad FFT y Bio-Input
1. **1. Pista de Audio Local (`🎵 Subir MP3/WAV`)**: Carga canciones locales (`MP3`, `WAV`, `FLAC`, `AAC`) con reproductor integrado (`▶️/⏸`, `🔁 Loop`). El audio se analiza por FFT en tiempo real y suena siempre por las bocinas del sistema.
2. **2. Entrada en Vivo (DAW / Interfaz / Mic)**:
   * **Selector de Dispositivo**: Elige entre micrófono, interfaz de audio USB (ej. SSL 2), o puentes virtuales (**BlackHole 2ch**, **Pro Tools Audio Bridge**, **Loopback**).
   * **`🎙️ Activar Entrada Live`**: Captura la señal entrante para análisis FFT.
   * **`🔊 Monitorear Audio (Thru)`**: Activa el monitoreo para escuchar por tus bocinas/audífonos la señal que viene desde un puente virtual (como BlackHole o Pro Tools) sin desconectar el analizador.
3. **3. Reactividad de Frecuencias (`FFT -> FX`)**:
   * **Medidores `BASS` (20–250 Hz), `MID` (250–2500 Hz) y `TREBLE` (2.5–12 kHz)** en tiempo real.
   * **Matriz de Ruteo**:
     * **`Bajos -> Deformar`**: Los graves golpean la distorsión (`Displace`) y el zoom.
     * **`Medios -> Color`**: Las frecuencias medias modulan la aberración cromática (`Chroma`) y el `Feedback`.
     * **`Agudos -> Caleido`**: Los agudos modulan el caleidoscopio y disparan destellos en picos altos.
   * **Perilla `AUDIO SENS` (CC 6)**: Controla la sensibilidad global de reacción al audio.
4. **4. 🌱 BIO-INPUT (`PURR DATA CC80 / NOTES`)**:
   * **`🌱 Bio -> Mundo 3D: ON/OFF`**: Habilita la inyección de señales bio-eléctricas (plantas/sensores en ESP32 o Purr Data) hacia los mundos 3D y el shader.
   * **Medidor `🌱 Bio-Pulso`**: Muestra la intensidad instantánea (`0.00` a `1.00`) recibida del sensor.

---

### 🔹 Módulo `[01 · GEN]` — Generador 2D, Mundos 3D y Texto Cinético
1. **Botón `⚡ Generador: ON/OFF`** y **4 Modos Generativos 2D (Shaders GLSL)**:
   * **`Fluid`**: Contornos de ruido Simplex fractal orgánico (`fbm`).
   * **`Vortex`**: Túnel hipnótico espiral.
   * **`Rings`**: Anillos concéntricos modulados por ruido.
   * **`Geo`**: Patrones geométricos de interferencia de ondas.
2. **4 Mundos 3D Interactivos (Three.js)**:
   * **`🦈 Ocean Diver 3D`**: Exploración submarina abisal con ballenas con ondas de sonar, tiburones, mantarrayas, medusas bioluminiscentes, cardúmenes de 300 peces y orbes de luz (haz clic en el agua para generar orbes).
   * **`🚗 Endless Drive`**: Conducción en 1ª persona por carretera curva con cabina detallada, Titán en el horizonte, objetos laterales reactivos y **4 biomas** (*Costa, Volcán con ríos de lava, Desierto y Bosque*).
   * **`🌿 Bio-Terra 3D`**: Ecosistema planetario de islas flotantes, cascadas de partículas luminosas, flora fractal que abre sus pétalos con la música/bio-pulso y criaturas polinizadoras de luz.
   * **`🏛️ Catedral / LiDAR 3D`**: Nube volumétrica de 45,000 puntos láser con un **Director Estocástico** que muta la arquitectura cada 16 beats entre *Bóvedas Góticas*, *Laberinto de Espejos*, *Reloj Astronómico Planetario* y *Monolitos Fractales*.
3. **Controles de Navegación 3D**:
   * **`➕ Objeto / Bioma`**: En *Endless Drive 3D*, genera un objeto sorpresa en la carretera y cambia al siguiente bioma (también con `Barra Espaciadora`).
   * **`🚀 Auto-Viaje 3D: ON/OFF`**: Activa o pausa el recorrido cinematográfico automático de la cámara (se puede combinar en todo momento con teclado `WASD`/Flechas, `Q`/`E` para subir/bajar, `R` para centrar cámara, arrastre con mouse y rueda de zoom).
4. **Barra de Texto 3D / Cinético en Vivo**:
   * Escribe cualquier frase en vivo (hasta 72 caracteres), elige **Tipografía** (*Impact, Arial, Courier New, Times New Roman, Comic Sans*), **Tamaño**, **Color** y **Estilo** (*Neón, Sólido, Oro, Cian*). En los mundos 3D se renderiza como texto extruido en 8 capas espaciales que vibran con el bajo y los agudos; en modo 2D/Media se dibuja como tipografía cinética reactiva.

---

### 🔹 Módulo `[02 · MOD FX]` — Deformación y Efectos Espaciales
* **Pads de Performance**:
  * **`⚡ Glitch`**: Dispara una ráfaga momentánea de alta distorsión y separación RGB.
  * **`❄️ Freeze`**: Congela o reanuda el fotograma actual en pantalla. *(Nota: al cambiar de mundo 3D, generador, imagen, o pulsar `✨ Clean` / `🔄 Reset`, el modo Freeze se desactiva automáticamente).*
  * **`🌀 Pixel / CRT`**: Activa un efecto continuo de mosaico pixelado reactivo al bajo con líneas de escaneo CRT y onda RGB.
  * **`✨ Clean`**: Desactiva `Freeze`, `Invert` y `Pixel/CRT`, y ajusta las perillas de deformación y color a valores sutiles para ver la imagen limpia.

---

### 🔹 Módulo `[03 · COLOR]` — Feedback y Paletas de Color
* **4 Pads de Paleta de Color**:
  * **`Original`**: Colores naturales de la fuente sin tinte ni saturación extra.
  * **`Cyberpunk`**: Saturación neón magenta/cian con estela de feedback media.
  * **`Infrarrojo`**: Mapa térmico psicodélico de alto contraste.
  * **`Monocromo`**: Blanco y negro de alto contraste.
* **Pads de Impacto**:
  * **`💥 Flash`**: Destello estroboscópico instantáneo (también disponible con la **`Barra Espaciadora`**).
  * **`🌗 Invert`**: Invierte los colores del lienzo en tiempo real.

---

### 🔹 Módulo `[04 · SEQUENCER / SHOW]` — Reloj BPM y Secuenciador de 8 Escenas (Cues)
Dividido en dos subcolumnas:
1. **Subcolumna Izquierda — Reloj Maestro de Tempo**:
   * **Candado `🔒` (BPM Lock)**: Cuando está activo (por defecto), mantiene fijo el BPM maestro de tu canción aunque cambies entre las 8 escenas.
   * **`🥁 TAP`**: Calcula el BPM automáticamente haciendo clic al ritmo de la música (4 clics).
   * **`⚡ Pulse: ON/OFF`**: Activa el modulador rítmico LFO sincronizado al BPM.
   * **`🎯 Pulso: Deformar / Caleido / Color`**: Elige qué familia de efectos modula el reloj de pulso.
   * **Selectores de División (`Div: 1/4, 1/2, 1/1, x2, x4`) y Forma de Onda (`∿ Sine`, `◺ Saw`, `⎍ Square`, `▲ Triangle`)**.
2. **Subcolumna Derecha — Secuenciador de Show en Vivo (8 Cues)**:
   * **8 Botones de Escena (`CUE 1` a `CUE 8`)**: Cada Cue guarda su propio nombre, fuente visual (cualquier Shader 2D, Mundo 3D, Imagen/Video subido o clip de API), posición de las perillas de efectos, paleta de color, texto 3D y duración individual (en **Beats** o **Segundos**).
   * **Edición Rápida y Drag & Drop**: Puedes renombrar el Cue activo, elegir su fuente en el menú desplegable, subirle una foto/video con **`🖼️ Subir`** (o arrastrar un archivo directamente encima de cualquiera de los 8 pads) y pulsar **`💾 Guardar`**.
   * **`▶ Seq`**: Avanza automáticamente de Cue en Cue respetando la duración en Beats o Segundos de cada escena con barra de progreso en vivo.
   * **`🚀 Auto-Show`**: Analiza continuamente la energía de la canción (Intro/Break suave -> Verso medio -> Coro/Drop intenso) y adapta automáticamente los efectos y paletas de color al ritmo de la música.
   * **`📥 Guardar Show` / `📂 Cargar Show`**: Exporta e importa tu show completo en un archivo `.vortex.json` (incluyendo los 8 Cues, BPM maestro y medios personalizados).

---

## 🎛️ 3. Cómo Funcionan las 14 Perillas (Knobs) y Mapa MIDI CC

Cada perilla se puede mover arrastrando verticalmente con el mouse, haciendo **doble clic** para volver a su valor inicial, o mediante un controlador MIDI.

| Perilla (Label) | ID Interno | Canal TouchDesigner | MIDI CC Default | Rango | Módulo | ¿Qué controla? |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **FREQ** | `frequency` | `k1_freq` | **CC 1** | `0.10 – 1.00` | `[01 · GEN]` | Escala y frecuencia espacial de los generadores 2D y densidad en 3D. |
| **DETAIL** | `detail` | `k2_detail` | **CC 2** | `0.00 – 1.00` | `[01 · GEN]` | Octavas de detalle fractal (FBM) y complejidad geométrica. |
| **SPEED** | `speed` | `k3_speed` | **CC 3** | `0.00 – 1.00` | `[01 · GEN]` | Velocidad de movimiento del shader 2D y velocidad de avance en los mundos 3D. |
| **DISPLACE** | `displace` | `k4_displace` | **CC 4** | `0.00 – 1.00` | `[02 · MOD FX]` | Intensidad de deformación líquida (UV Warp / Displace TOP). |
| **WARP FRQ** | `warpScale` | `k5_warp` | **CC 5** | `0.10 – 1.00` | `[02 · MOD FX]` | Frecuencia de las ondas de distorsión sobre la imagen. |
| **AUDIO SENS** | `audioDepth` | `k6_audio` | **CC 6** | `0.00 – 1.00` | `[0A · AUDIO]` | Sensibilidad global del analizador FFT (qué tanto golpean el bajo, medio y agudo). |
| **FEEDBACK** | `feedback` | `k7_feedback` | **CC 7** | `0.00 – 0.96` | `[03 · COLOR]` | Estela de movimiento (Feedback ping-pong FBO). |
| **CHROMA** | `chroma` | `k8_chroma` | **CC 8** | `0.00 – 1.00` | `[03 · COLOR]` | Separación cromática RGB radial y saturación psicodélica. |
| **HUE ROT** | `hue` | `k9_hue` | **CC 9** | `0° – 360°` | `[03 · COLOR]` | Rotación del círculo cromático (tono general de color). |
| **KALEIDO** | `kaleido` | `k10_kaleido` | **CC 10** | `0.00 – 1.00` | `[02 · MOD FX]` |Divisiones de simetría caleidoscópica (de 0 a 16 espejos). |
| **ANGLE** | `mirrorAngle` | `k11_angle` | **CC 11** | `0° – 360°` | `[02 · MOD FX]` | Rotación global del lienzo y mutación de la reliquia geométrica en *Catedral 3D*. |
| **TEMPO** | `bpm` | `k12_bpm` | **CC 12** | `40 – 200 BPM` | `[04 · SHOW]` | Velocidad del reloj maestro BPM para el pulso LFO y el secuenciador de Cues. |
| **CAM ORBIT** | `camOrbit` | `k13_cam_orbit` | **CC 13** | `0° – 360°` | `[01 · GEN]` | Órbita horizontal de la cámara en los 4 mundos 3D (o giro de volante en *Endless Drive*). |
| **CAM ZOOM** | `camZoom` | `k14_cam_zoom` | **CC 14** | `0% – 100%` | `[01 · GEN]` | Distancia / Zoom de la cámara dentro de los mundos 3D. |

---

## 🎹 4. Conexión Automática MIDI en el Navegador (Web MIDI API)

VORTEX utiliza la **API nativa Web MIDI (`navigator.requestMIDIAccess`)**, eliminando cualquier dependencia de Purr Data o servidores WebSocket locales y funcionando directamente sobre **HTTPS en GitHub Pages (`https://jalalokote.github.io/Vortex_Visuals/`)** o en local.

### 1. Auto-conexión por USB
* Al abrir la página, la aplicación solicita automáticamente `navigator.requestMIDIAccess()` y añade un listener para el evento `midimessage` en todas las entradas (`inputs`) MIDI USB disponibles.
* Si conectas o desconectas un controlador MIDI con la página abierta, el evento `onstatechange` lo detecta al instante.
* En la barra superior verás el indicador **"Estado MIDI: Conectado (Nombre del Dispositivo)"** (en verde) o **"Estado MIDI: Desconectado"** si no hay ningún controlador USB conectado.

### 2. Procesamiento y Escalado de Datos (Control Change)
* El motor filtra los mensajes **Control Change (`0xB0` / `176..191`)** y aplica la matemática de normalización dividiendo el valor entrante (`0 - 127`) entre `127`:
  ```javascript
  const normalizedValue = Math.max(0.0, Math.min(1.0, rawValue / 127.0));
  ```
* Ese valor normalizado (`0.0` a `1.0`) se escala automáticamente al rango real de cada parámetro o perilla (`min` a `max`).

### 3. Sistema de MIDI Learn (Sliders de Parámetros y Perillas)
* **En los Sliders de Parámetros (`Offset X`, `Offset Y`, `Zoom`, `Opacidad` y `Tamaño Texto 3D`)**:
  * Haz clic en el botón **`Learn`** ubicado justo al lado del slider. El botón cambiará a **`⏳ CC...`** (en ámbar).
  * Mueve cualquier perilla o fader en tu controlador MIDI físico.
  * El sistema capturará automáticamente ese número de CC, mostrará **`CC #`** en el botón, guardará la asignación en el navegador (`localStorage`) y controlará ese parámetro en tiempo real. *(Haz **clic derecho** sobre el botón `CC #` para borrar la asignación).*
* **En las 14 Perillas Rotativas (Knobs)**:
  * Haz clic directamente sobre la etiqueta **`CC #` / `Learn`** en la esquina superior derecha de cualquier perilla (o activa el botón global **`🎹 MIDI Learn`** en la barra superior y haz clic en la perilla/botón deseado) y mueve un control físico en tu hardware MIDI.

---

## 🌱 5. Instrucciones para Conectar el ESP32 / Bio-Sensor

La sección **`🌱 BIO-INPUT`** permite que una planta, sensor galvánico (GSR), pulso cardíaco, LDR o potenciómetro conectado a un **ESP32** module en vivo los mundos 3D y los efectos visuales.

### Cómo enviar datos desde el ESP32
El servidor (`server.js`) acepta y normaliza automáticamente lecturas en rango **`0.0–1.0`**, **`0–127`** (MIDI), **`0–1023`** (Arduino 10-bit ADC) o **`0–4095`** (ESP32 12-bit ADC). Puedes conectarlo de **3 maneras**:

#### Vía 1: Wi-Fi UDP Directo desde el ESP32 (Recomendado)
Conecta tu ESP32 a la misma red Wi-Fi que tu computadora y envía paquetes **UDP** a la IP de tu computadora en el **puerto `8080`** (o `9000`) usando cualquiera de estos formatos de texto:
```text
bio 2048;
```
*(donde `2048` puede ser la lectura cruda de `analogRead(pin)` de `0` a `4095`, o un flotante de `0.0` a `1.0` como `bio 0.75;`)*.

**Ejemplo de código Arduino para ESP32 (Wi-Fi UDP):**
```cpp
#include <WiFi.h>
#include <WiFiUdp.h>

const char* ssid = "TU_WIFI";
const char* password = "TU_PASSWORD";
const char* pc_ip = "192.168.1.100"; // IP local de tu Mac/PC
const int udp_port = 8080;
const int BIO_PIN = 34; // Pin ADC del ESP32

WiFiUDP udp;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12); // 0 .. 4095
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(300); }
}

void loop() {
  int rawValue = analogRead(BIO_PIN); // 0 .. 4095
  float normalized = rawValue / 4095.0;
  char packet[32];
  snprintf(packet, sizeof(packet), "bio %.3f;", normalized);

  udp.beginPacket(pc_ip, udp_port);
  udp.print(packet);
  udp.endPacket();

  delay(35); // ~28 envíos por segundo
}
```

#### Vía 2: ESP32 -> Purr Data (`CC 80` o Notas) -> VORTEX
Si tu ESP32 envía datos por USB Serial o MIDI a **Purr Data**:
* Envía el valor normalizado (`0.0` a `1.0`) en el canal **CC 80** (o **CC 14 a 17**):
  ```text
  send 0.85 80;
  ```
* O envía pulsos como **Notas MIDI** (`send note 60 127;`). Cada nota recibida dispara un pico de **Bio-Pulso** proporcional a su velocidad.

#### Vía 3: WebSocket Directo (`ws://<IP_DE_TU_PC>:8080`)
El ESP32 también puede enviar un JSON por WebSocket:
```json
{ "type": "bio_data", "value": 0.82 }
```

### ¿Qué hace el Bio-Pulso dentro de la página?
Asegúrate de que el botón **`🌱 Bio -> Mundo 3D: ON`** (en el panel `[0A · AUDIO]`) esté encendido:
* **En `🌿 Bio-Terra 3D`**: Abre los pétalos geométricos de las flores fractales, acelera las cascadas luminosas y excita las criaturas polinizadoras de luz.
* **En `🦈 Ocean Diver 3D`**: Genera orbes bioluminiscentes que atraen a los peces y activa las ondas de sonar de las ballenas.
* **En `🚗 Endless Drive 3D`**: Intensifica las erupciones de lava y al recibir pulsos/notas cambia de bioma y genera objetos laterales.
* **En `🏛️ Catedral / LiDAR 3D`**: Provoca ondas de dispersión y ensamblaje en los 45,000 puntos láser y monolitos.
* **En el Shader 2D / Media**: Añade modulación orgánica sobre `Displace` y `Warp`.

---

## 🎥 6. Conexión con TouchDesigner (Modo TD Live Controller)

Si deseas usar VORTEX para controlar un proyecto `.toe` en **TouchDesigner**:
1. Haz clic en el botón **`🎥 TD`** en la barra superior.
2. En tu proyecto de TouchDesigner, crea un nodo **`WebSocket DAT`** conectado a **`ws://localhost:8080`** (o usa el archivo incluido `mcp_webserver_base.toe`).
3. TouchDesigner recibirá en tiempo real paquetes JSON estandarizados:
   * **Perillas**: `{ "type": "td_control", "id": "displace", "channel": "k4_displace", "cc": 4, "value": 0.5, "scaledValue": 0.5 }`
   * **Botones / Triggers**: `{ "type": "td_trigger", "id": "fx_glitch", "action": "fx_glitch", "value": 1, "state": true }`
   * **Medios**: `{ "type": "td_media", "source": "/uploads/...", "mediaType": "image", "absolutePath": "/..." }`
   * **Audio FFT y BPM** *(activando el botón `⚡ Enviar Audio FFT y BPM a TD: ON`)*: `{ "type": "td_audio", "bass": 0.65, "mid": 0.42, "treble": 0.31, "bpm": 120, "beat": 0.8 }`

---

## ⌨️ 7. Atajos Rápidos de Teclado

| Tecla | Acción |
| :---: | :--- |
| **`1` – `8`** | Activar instantáneamente las escenas **`CUE 1` a `CUE 8`** del Show. |
| **`Shift + R`** | **Reset de emergencia (`🔄 Reset`)**: descongela y reinicia los visuales y efectos sin detener la música. |
| **`Espacio`** | Dispara **`💥 Flash`** (y en *Endless Drive 3D* cambia bioma / genera objeto en carretera). |
| **`W` `A` `S` `D` / Flechas** | Mover y girar la cámara dentro de los **Mundos 3D**. |
| **`Q` / `E`** | Subir / bajar altura de cámara en los **Mundos 3D**. |
| **`R`** | recentrar la cámara del **Mundo 3D** actual. |
| **`F`** | Activar / salir de **Pantalla Completa**. |
| **`H`** | Ocultar / mostrar todos los paneles del **HUD** para dejar solo los visuales. |
