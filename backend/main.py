import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import close_db_pool, get_db, init_db_pool
from logger import (
    attach_request_logging_middleware,
    attach_unhandled_exception_logging,
    get_logger,
    log_startup,
    setup_logging,
)
from routers import dashboard, records, users

setup_logging()
logger = get_logger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
PORT = os.getenv("PORT", "8000")

raw_allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
if not raw_allowed_origins:
    raw_allowed_origins = os.getenv("CORS_EXTRA_ORIGINS", "")

configured_origins: List[str] = [
    origin.strip() for origin in raw_allowed_origins.split(",") if origin.strip()
]

allow_origins: List[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *configured_origins,
]

# Preserve order while removing duplicates.
allow_origins = list(dict.fromkeys(allow_origins))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    db_connected = False

    try:
        init_db_pool()
        with get_db() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
        db_connected = True
    except Exception:
        logger.exception("Database initialization failed during startup")
        raise

    log_startup(
        environment=ENVIRONMENT,
        port=PORT,
        cors_allowed_origins=allow_origins,
        db_connected=db_connected,
    )

    try:
        yield
    finally:
        close_db_pool()
        logger.info("Server shutdown complete")


app = FastAPI(
    title="Finance Dashboard API",
    version="0.1.0",
    lifespan=lifespan,
)

attach_request_logging_middleware(app)
attach_unhandled_exception_logging(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(records.router, prefix="/records", tags=["records"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
