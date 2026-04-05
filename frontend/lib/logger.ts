type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const PRODUCTION_MIN_LEVEL: LogLevel = "warn";
const DEVELOPMENT_MIN_LEVEL: LogLevel = "debug";

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

function shouldLog(level: LogLevel) {
  const min = process.env.NODE_ENV === "production" ? PRODUCTION_MIN_LEVEL : DEVELOPMENT_MIN_LEVEL;
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[min];
}

function normalizeError(error?: unknown): string | undefined {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error === undefined || error === null) {
    return undefined;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unserializable error object";
  }
}

function shipErrorLog(payload: LogPayload): void {
  const body = JSON.stringify(payload);

  try {
    if (typeof window !== "undefined") {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/logs", blob);
        return;
      }

      void fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
      return;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    void fetch(`${baseUrl}/api/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    // Intentionally swallow logger transport errors.
  }
}

function printToConsole(payload: LogPayload): void {
  if (!shouldLog(payload.level)) {
    return;
  }

  const base = `[${nowTime()}] [${payload.level.toUpperCase()}] [${payload.module}] ${payload.message}`;

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const colorMap: Record<LogLevel, string> = {
      debug: "#64748b",
      info: "#0ea5e9",
      warn: "#f59e0b",
      error: "#ef4444",
    };
    // eslint-disable-next-line no-console
    console.log(`%c${base}`, `color: ${colorMap[payload.level]}; font-weight: 600;`, payload.data ?? "");
    return;
  }

  if (payload.level === "error") {
    // eslint-disable-next-line no-console
    console.error(base, payload.data ?? "");
  } else if (payload.level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(base, payload.data ?? "");
  } else {
    // eslint-disable-next-line no-console
    console.log(base, payload.data ?? "");
  }
}

function emit(level: LogLevel, module: string, message: string, data?: unknown): void {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data,
  };

  printToConsole(payload);

  if (level === "error") {
    shipErrorLog(payload);
  }
}

export const logger = {
  info(module: string, message: string, data?: unknown) {
    emit("info", module, message, data);
  },
  warn(module: string, message: string, data?: unknown) {
    emit("warn", module, message, data);
  },
  error(module: string, message: string, error?: unknown) {
    emit("error", module, message, normalizeError(error));
  },
  debug(module: string, message: string, data?: unknown) {
    emit("debug", module, message, data);
  },
};
