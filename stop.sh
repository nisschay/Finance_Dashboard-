#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

stop_pid() {
  local name="$1"
  local pid="$2"

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "$name was not running"
    return
  fi

  kill -TERM "$pid" >/dev/null 2>&1 || true

  for _ in {1..5}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      echo "$name stopped"
      return
    fi
    sleep 1
  done

  kill -KILL "$pid" >/dev/null 2>&1 || true
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    echo "$name force stopped"
  else
    echo "Failed to stop $name"
  fi
}

stop_from_pid_file() {
  local name="$1"
  local file="$2"

  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    stop_pid "$name" "$pid"
    rm -f "$file"
  else
    echo "$name PID file not found"
  fi
}

find_pid_on_port() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$port" -sTCP:LISTEN | head -n1
    return
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$port" 2>/dev/null | awk -F'pid=' 'NR>1 {split($2,a,","); print a[1]}' | head -n1
    return
  fi

  echo ""
}

fallback_stop_port() {
  local name="$1"
  local port="$2"
  local pid
  pid="$(find_pid_on_port "$port")"

  if [[ -n "$pid" ]]; then
    stop_pid "$name (port $port)" "$pid"
  else
    echo "$name not found on port $port"
  fi
}

stop_from_pid_file "Backend" "$BACKEND_PID_FILE"
stop_from_pid_file "Frontend" "$FRONTEND_PID_FILE"

# Fallback for interrupted starts before pid files were written.
fallback_stop_port "Backend" 8000
fallback_stop_port "Frontend" 3000

rm -f "$PID_DIR"/*.pid

echo "All stop operations complete."
