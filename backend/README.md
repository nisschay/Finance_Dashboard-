# Finance Dashboard Backend

FastAPI backend for a finance dashboard, designed for deployment to Hugging Face Spaces, with Neon PostgreSQL and Firebase Auth.

## Quick start

1. Create environment variables:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Apply schema to Neon PostgreSQL:

```bash
psql "$DATABASE_URL" -f schema.sql
```

4. Start API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 7860
```

## Required environment variables

- `DATABASE_URL`: Neon PostgreSQL connection URI
- `FIREBASE_PROJECT_ID`: Firebase project ID

## Optional environment variables

- `MIN_DB_CONNECTIONS`: default `1`
- `MAX_DB_CONNECTIONS`: default `10`
- `CORS_EXTRA_ORIGINS`: comma-separated additional allowed origins
