import logging
import os
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Iterable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


_LOGGING_INITIALIZED = False


def _build_formatter() -> logging.Formatter:
    return logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(module)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def _log_dir() -> Path:
    path = Path(os.getenv("LOG_DIR", "./logs")).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def setup_logging() -> None:
    global _LOGGING_INITIALIZED

    if _LOGGING_INITIALIZED:
        return

    formatter = _build_formatter()
    environment = os.getenv("ENVIRONMENT", "development").lower()
    log_level_name = os.getenv("LOG_LEVEL", "DEBUG" if environment == "development" else "INFO")
    log_level = getattr(logging, log_level_name.upper(), logging.INFO)

    logs = _log_dir()

    app_file_handler = RotatingFileHandler(
        logs / "backend.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
    )
    app_file_handler.setLevel(log_level)
    app_file_handler.setFormatter(formatter)

    error_file_handler = RotatingFileHandler(
        logs / "backend_errors.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()
    root_logger.addHandler(app_file_handler)
    root_logger.addHandler(error_file_handler)

    if environment == "development":
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(log_level)
        stream_handler.setFormatter(formatter)
        root_logger.addHandler(stream_handler)

    _LOGGING_INITIALIZED = True


def get_logger(name: str) -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)


def attach_request_logging_middleware(app: FastAPI) -> None:
    logger = get_logger("middleware")

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        start = time.perf_counter()
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            query = request.url.query if request.url.query else "-"
            auth_user = getattr(request.state, "auth_user", {})
            user_id = auth_user.get("id", "-") if isinstance(auth_user, dict) else "-"
            role = auth_user.get("role", "-") if isinstance(auth_user, dict) else "-"
            logger.info(
                "%s %s | query=%s | user=%s | role=%s | %s | %.2fms",
                request.method,
                request.url.path,
                query,
                user_id,
                role,
                status_code,
                elapsed_ms,
            )


def attach_unhandled_exception_logging(app: FastAPI) -> None:
    logger = get_logger("errors")

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception during %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                }
            },
        )


def log_startup(
    *,
    environment: str,
    port: str,
    cors_allowed_origins: Iterable[str],
    db_connected: bool,
) -> None:
    logger = get_logger("startup")
    origins_list = list(cors_allowed_origins)
    logger.info(
        "Environment=%s | Port=%s | DB=%s | CORS=%s",
        environment,
        port,
        "connected" if db_connected else "failed",
        ",".join(origins_list) if origins_list else "-",
    )
