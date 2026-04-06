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

find_pid_on_port() {
  local port="$1"
  local pid=""

  if command -v ss >/dev/null 2>&1; then
    pid="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '
      /LISTEN/ && index($4, p) > 0 {
        if (match($0, /pid=[0-9]+/)) {
          print substr($0, RSTART + 4, RLENGTH - 4)
          exit
        }
      }
    ')"
    if [[ -n "$pid" ]]; then
      echo "$pid"
      return
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    pid="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null | head -n1 || true)"
    if [[ -n "$pid" ]]; then
      echo "$pid"
      return
    fi
  fi

  echo ""
}

stop_pid_gracefully() {
  local pid="$1"
  local label="$2"

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return
  fi

  kill -TERM "$pid" >/dev/null 2>&1 || true

  for _ in {1..5}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      print_info "$label (PID $pid) stopped"
      return
    fi
    sleep 1
  done

  kill -KILL "$pid" >/dev/null 2>&1 || true

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    print_info "$label (PID $pid) force stopped"
  fi
}

ensure_port_ready() {
  local port="$1"
  local service_name="$2"
  local pid
  pid="$(find_pid_on_port "$port")"

  if [[ -z "$pid" ]]; then
    return
  fi

  local cmd
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"

  if [[ -n "$cmd" && "$cmd" == *"$ROOT_DIR"* ]]; then
    print_info "Port $port occupied by stale project process (PID $pid). Stopping it."
    stop_pid_gracefully "$pid" "$service_name"
    return
  fi

  print_error "Port $port is already in use by PID $pid.${cmd:+ Command: $cmd}"
  print_error "Stop the conflicting process or change port configuration, then retry ./start.sh"
  exit 1
}

load_backend_env() {
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line="$raw_line"

    # Strip Windows CR if present.
    line="${line%$'\r'}"

    # Skip comments and empty lines.
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

    # Ignore malformed lines without key=value shape.
    [[ "$line" == *"="* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"

    # Trim surrounding spaces around key.
    key="${key#${key%%[![:space:]]*}}"
    key="${key%${key##*[![:space:]]}}"

    # Trim surrounding spaces around value.
    value="${value#${value%%[![:space:]]*}}"
    value="${value%${value##*[![:space:]]}}"

    # Unwrap optional quotes.
    if [[ "$value" =~ ^".*"$ ]]; then
      value="${value:1:-1}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:-1}"
    fi

    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      export "$key=$value"
    fi
  done < "$BACKEND_DIR/.env"
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

  if [[ "${SKIP_DB_MIGRATION:-0}" == "1" ]]; then
    print_info "SKIP_DB_MIGRATION=1 set, skipping schema migration step"
    return
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    print_error "DATABASE_URL is not set in backend/.env"
    exit 1
  fi

  if ! DATABASE_URL_VALUE="$DATABASE_URL" python3 - <<'PY'
import os
import socket
import sys
from urllib.parse import urlparse

url = os.getenv("DATABASE_URL_VALUE", "")
if not url:
    print("DATABASE_URL missing")
    raise SystemExit(1)

parsed = urlparse(url)
host = parsed.hostname
port = parsed.port or 5432

if not host:
    print("DATABASE_URL host is missing")
    raise SystemExit(1)

try:
    socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
except Exception as exc:
    print(f"DNS resolution failed for {host}:{port} -> {exc!r}")
    raise SystemExit(2)

try:
    conn = socket.create_connection((host, port), timeout=5)
    conn.close()
except Exception as exc:
    print(f"TCP connection failed for {host}:{port} -> {exc!r}")
    raise SystemExit(3)

print(f"Database network precheck passed for {host}:{port}")
PY
  then
    print_error "Database host is unreachable from this machine. Check network/VPN/firewall and Neon endpoint settings."
    exit 1
  fi

  print_info "Applying schema.sql to DATABASE_URL"

  local status=0
  local stderr_log
  stderr_log="$(mktemp)"

  if command -v timeout >/dev/null 2>&1; then
    timeout 30 env PGCONNECT_TIMEOUT=10 psql -w -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$BACKEND_DIR/schema.sql" >/dev/null 2>"$stderr_log" || status=$?
  else
    env PGCONNECT_TIMEOUT=10 psql -w -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$BACKEND_DIR/schema.sql" >/dev/null 2>"$stderr_log" || status=$?
  fi

  if [[ "$status" -ne 0 ]]; then
    if [[ "$status" -eq 124 ]]; then
      print_error "Database migration timed out after 30s. Check Neon connectivity and DATABASE_URL host/credentials."
    else
      print_error "Failed to apply schema.sql to DATABASE_URL."
    fi

    if [[ -s "$stderr_log" ]]; then
      echo "--- psql error output ---" >&2
      cat "$stderr_log" >&2
      echo "-------------------------" >&2
    fi

    rm -f "$stderr_log"
    exit 1
  fi

  rm -f "$stderr_log"
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
ensure_port_ready 8000 "Backend"
ensure_port_ready 3000 "Frontend"
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
