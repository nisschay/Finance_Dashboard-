#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"
PID_DIR="$ROOT_DIR/.pids"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
BACKEND_REQ_HASH_FILE="$PID_DIR/backend_requirements.sha256"
FRONTEND_PKG_HASH_FILE="$PID_DIR/frontend_packages.sha256"

print_error() {
  echo "[ERROR] $1" >&2
}

print_info() {
  echo "[INFO] $1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print_error "Required command '$1' is not installed."
    exit 1
  fi
}

check_python_version() {
  require_command python3
  local py_version
  py_version="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  local major minor
  major="${py_version%%.*}"
  minor="${py_version##*.}"

  if (( major < 3 || (major == 3 && minor < 10) )); then
    print_error "Python 3.10+ is required. Found: $py_version"
    exit 1
  fi

  print_info "Python version OK: $py_version"
}

check_node_version() {
  require_command node
  local node_version
  node_version="$(node -v | sed 's/^v//')"
  local major
  major="${node_version%%.*}"

  if (( major < 18 )); then
    print_error "Node.js 18+ is required. Found: $node_version"
    exit 1
  fi

  print_info "Node.js version OK: $node_version"
}

require_file() {
  if [[ ! -f "$1" ]]; then
    print_error "$2"
    exit 1
  fi
}

load_backend_env() {
  set -a
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/.env"
  set +a
}

ensure_dirs() {
  mkdir -p "$LOG_DIR" "$PID_DIR"
}

ensure_backend_venv() {
  if [[ ! -d "$BACKEND_DIR/venv" ]]; then
    print_info "Creating backend virtual environment at backend/venv"
    python3 -m venv "$BACKEND_DIR/venv"
  fi
}

install_backend_requirements_if_needed() {
  local current_hash
  current_hash="$(sha256sum "$BACKEND_DIR/requirements.txt" | awk '{print $1}')"

  if [[ ! -f "$BACKEND_REQ_HASH_FILE" ]] || [[ "$(cat "$BACKEND_REQ_HASH_FILE")" != "$current_hash" ]]; then
    print_info "Installing backend dependencies"
    # shellcheck disable=SC1091
    source "$BACKEND_DIR/venv/bin/activate"
    pip install -r "$BACKEND_DIR/requirements.txt"
    deactivate
    echo "$current_hash" > "$BACKEND_REQ_HASH_FILE"
  else
    print_info "Backend dependencies unchanged, skipping pip install"
  fi
}

run_backend_schema() {
  require_command psql

  if [[ -z "${DATABASE_URL:-}" ]]; then
    print_error "DATABASE_URL is not set in backend/.env"
    exit 1
  fi

  print_info "Applying schema.sql to DATABASE_URL"
  psql "$DATABASE_URL" -f "$BACKEND_DIR/schema.sql" >/dev/null
}

install_frontend_dependencies_if_needed() {
  require_command npm
  local hash_source="$FRONTEND_DIR/package.json"

  if [[ -f "$FRONTEND_DIR/package-lock.json" ]]; then
    hash_source="$FRONTEND_DIR/package-lock.json"
  fi

  local current_hash
  current_hash="$(sha256sum "$hash_source" | awk '{print $1}')"

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]] || [[ ! -f "$FRONTEND_PKG_HASH_FILE" ]] || [[ "$(cat "$FRONTEND_PKG_HASH_FILE")" != "$current_hash" ]]; then
    print_info "Installing frontend dependencies"
    (cd "$FRONTEND_DIR" && npm install)
    echo "$current_hash" > "$FRONTEND_PKG_HASH_FILE"
  else
    print_info "Frontend dependencies unchanged, skipping npm install"
  fi
}

start_backend() {
  print_info "Starting backend on http://localhost:8000"
  bash -c "cd '$BACKEND_DIR' && source venv/bin/activate && exec uvicorn main:app --reload --host 0.0.0.0 --port 8000" \
    > >(tee -a "$LOG_DIR/backend.log") \
    2> >(tee -a "$LOG_DIR/backend.log" >&2) &
  local backend_pid=$!
  echo "$backend_pid" > "$BACKEND_PID_FILE"
  print_info "Backend PID: $backend_pid"
}

start_frontend() {
  print_info "Starting frontend on http://localhost:3000"
  bash -c "cd '$FRONTEND_DIR' && exec npm run dev -- --port 3000" \
    > >(tee -a "$LOG_DIR/frontend.log") \
    2> >(tee -a "$LOG_DIR/frontend.log" >&2) &
  local frontend_pid=$!
  echo "$frontend_pid" > "$FRONTEND_PID_FILE"
  print_info "Frontend PID: $frontend_pid"
}

shutdown() {
  echo "Shutting down..."
  "$ROOT_DIR/stop.sh" || true
  exit 0
}

trap shutdown INT TERM

check_python_version
check_node_version
require_file "$BACKEND_DIR/.env" "backend/.env is missing. Create it before running start.sh"
require_file "$FRONTEND_DIR/.env.local" "frontend/.env.local is missing. Create it before running start.sh"
ensure_dirs
load_backend_env
ensure_backend_venv
install_backend_requirements_if_needed
run_backend_schema
install_frontend_dependencies_if_needed
start_backend
start_frontend

cat <<'EOF'
┌─────────────────────────────────────────┐
│  Finance Dashboard — Running            │
│                                         │
│  Backend:   http://localhost:8000       │
│  API Docs:  http://localhost:8000/docs  │
│  Frontend:  http://localhost:3000       │
│                                         │
│  Logs:      ./logs/                     │
│  Stop:      ./stop.sh                   │
└─────────────────────────────────────────┘
EOF

wait
