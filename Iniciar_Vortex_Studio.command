#!/bin/zsh
# ==============================================================================
#  VORTEX STUDIO — Lanzador de 1 Clic para macOS
#  Inicia el servidor Node.js y abre automáticamente el navegador en localhost:3000
# ==============================================================================

# Cambiar al directorio donde se encuentra este script
cd "$(dirname "$0")"

# Asegurar que Node.js esté en el PATH
export PATH="$HOME/.local/share/node-v22.23.4-darwin-arm64/bin:$HOME/.gemini/antigravity/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "===================================================================="
echo "🎨 VORTEX STUDIO — TouchDesigner Real-Time Media FX"
echo "===================================================================="
echo "📡 Iniciando servidor web local..."
echo "🎥 Transmisión MJPEG conectada a TouchDesigner (Puerto 9981)"
echo "🚀 Abriendo http://localhost:3000 en tu navegador predeterminado..."
echo "💡 Para detener el servidor cuando termines, presiona: Ctrl + C"
echo "===================================================================="

# Abrir el navegador tras 1 segundo
(sleep 1 && open "http://localhost:3000") &

# Ejecutar el servidor web
node "interactive-web-td/server.js"

