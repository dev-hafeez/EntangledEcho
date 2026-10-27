#!/usr/bin/env bash
set -e

# Entangled Echo - Unified Startup Script
# Starts both the AI backend (FastAPI :8001) and Web frontend (Next.js :3000)

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "         ENTANGLED ECHO - LAUNCHING LOCAL STACK           "
echo "=========================================================="

# 1. Ensure Environment Files Exist
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo "Notice: .env not found. Creating from .env.example..."
  cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
fi

if [ ! -f "$PROJECT_ROOT/apps/web/.env.local" ]; then
  echo "Notice: apps/web/.env.local not found. Syncing from .env..."
  cp "$PROJECT_ROOT/.env" "$PROJECT_ROOT/apps/web/.env.local"
fi

# 2. Clean up any existing stale processes on ports 8001 and 3000
echo "[1/4] Checking and clearing ports 8001 and 3000..."
fuser -k 8001/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# 3. Check Python Virtual Environment
VENV_PYTHON="$PROJECT_ROOT/services/ai/.venv/bin/python3"
VENV_UVICORN="$PROJECT_ROOT/services/ai/.venv/bin/uvicorn"

if [ ! -f "$VENV_PYTHON" ] || [ ! -f "$VENV_UVICORN" ]; then
  echo "Error: Python virtual environment not found in services/ai/.venv"
  echo "Please set up the environment with:"
  echo "  cd services/ai"
  echo "  python3 -m venv .venv"
  echo "  source .venv/bin/activate"
  echo "  pip install -r requirements.txt"
  echo "  playwright install chromium"
  exit 1
fi

# Check Node modules
if [ ! -d "$PROJECT_ROOT/node_modules" ] || [ ! -d "$PROJECT_ROOT/apps/web/node_modules" ]; then
  echo "Notice: Node dependencies missing. Running pnpm install..."
  pnpm install
fi

# Cleanup handler for graceful shutdown on Ctrl+C
cleanup() {
  echo ""
  echo "Stopping Entangled Echo servers..."
  kill $(jobs -p) 2>/dev/null || true
  fuser -k 8001/tcp 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  echo "All servers stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 4. Start AI Backend Service (Port 8001)
echo "[2/4] Starting AI Backend Service on http://127.0.0.1:8001..."
cd "$PROJECT_ROOT/services/ai"
export PYTHONPATH="$PROJECT_ROOT/services/ai"
"$VENV_UVICORN" app.main:app --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend health check
echo "[3/4] Waiting for AI Backend to be healthy..."
RETRIES=15
while [ $RETRIES -gt 0 ]; do
  if curl -s http://127.0.0.1:8001/health >/dev/null 2>&1; then
    echo "✓ AI Backend is healthy and ready on port 8001!"
    break
  fi
  sleep 1
  RETRIES=$((RETRIES - 1))
done

if [ $RETRIES -eq 0 ]; then
  echo "Warning: AI Backend health check timed out. Proceeding anyway..."
fi

# 5. Start Next.js Web Frontend (Port 3000)
echo "[4/4] Starting Web Frontend on http://localhost:3000..."
echo ""
echo "=========================================================="
echo "🚀 Web App:     http://localhost:3000"
echo "🛠  Admin Panel: http://localhost:3000/admin"
echo "⚡ AI API Docs:  http://localhost:8001/docs"
echo "=========================================================="
echo "Press Ctrl+C to stop all servers."
echo ""

pnpm --filter web dev
