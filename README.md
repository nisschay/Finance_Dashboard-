# Finance Dashboard

## 1. Project Title and Overview

Finance Dashboard is a full-stack financial tracking and analytics system designed for teams that need secure, role-aware access to operational finance data. It combines Firebase authentication, FastAPI APIs, and PostgreSQL persistence to support user onboarding, record lifecycle management, and analytics reporting in a single workflow. The project solves the practical problem of giving different user roles safe, appropriate access to financial actions while maintaining auditable data history through soft delete.

## 2. Architecture Overview

The frontend authenticates the user through Firebase Google Sign-In and sends the Firebase ID token as a Bearer token with each API call. The backend validates the token using cached Firebase public keys, resolves the local user profile and status from the database, enforces route-level role requirements, executes service-layer business logic, and reads or writes data in PostgreSQL. This creates a clear security and data flow from identity to authorization to persistence.

```text
+-------------------+      +------------------+      +-------------------+      +------------------+
| Next.js Frontend  | ---> | Firebase Auth    | ---> | FastAPI Backend   | ---> | Neon PostgreSQL  |
| (Vercel)          |      | (ID Token Issuer)|      | (HF Spaces)       |      | (Primary DB)     |
+-------------------+      +------------------+      +-------------------+      +------------------+
         ^                         |                           |                            |
         +-------------------------+---------------------------+----------------------------+
                      Authenticated request/response lifecycle with Bearer JWT
```

FastAPI was chosen for strongly typed API development and rapid iteration with clear dependency injection patterns. Firebase Auth was chosen to offload identity management and leverage secure, standards-based JWT issuance. Neon PostgreSQL was chosen for relational integrity, SQL-native aggregation, and reliable financial data storage semantics such as DECIMAL precision and enum constraints. Next.js with TypeScript was chosen for a maintainable frontend with typed API integration and straightforward deployment on Vercel.

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | Typed client code, production-ready routing, Vercel-native deployment |
| Styling | Tailwind CSS | Fast, consistent UI composition for dashboards and forms |
| Authentication | Firebase Auth (Google Sign-In) | Secure, managed identity with JWT tokens for backend verification |
| Backend API | FastAPI (Python) | Strong typing, async support, dependency injection, and clean API structure |
| Authorization | Custom RBAC via require_roles() | Declarative role gating at route level |
| Database | Neon PostgreSQL | Durable relational storage and SQL-first analytics |
| DB Access | psycopg2 (raw SQL) | Direct control over SQL and query behavior |
| Backend Hosting | HuggingFace Spaces | Simple deployment surface for Python API workloads |
| Frontend Hosting | Vercel | Optimized delivery for Next.js applications |
| Testing | pytest + pytest-asyncio | Behavior-focused backend validation with fixture-driven setup |

## 4. Security Model

The security model follows three sequential layers. First, each protected request must include a Firebase ID token that the backend verifies using Firebase public keys. Second, after token verification, the backend resolves the user from the local database and blocks inactive accounts. Third, route-level role checks enforce whether the authenticated and active user can perform the requested operation. This layering ensures that identity, account lifecycle, and permission policy are enforced separately and predictably.

| Role | User Management | Financial Records (Read) | Financial Records (Create/Update) | Financial Records (Delete) | Dashboard Summary/Category/Trends | Dashboard Recent |
|---|---|---|---|---|---|---|
| viewer | allowed (sync, me), not allowed (admin user management) | allowed | not allowed | not allowed | not allowed | allowed |
| analyst | allowed (sync, me), not allowed (admin user management) | allowed | allowed | not allowed | allowed | allowed |
| admin | allowed | allowed | allowed | allowed | allowed | allowed |

Roles are stored in PostgreSQL instead of Firebase token claims because authorization is an internal business concern, not an identity-provider concern. This lets role/status changes take effect immediately without requiring token re-issuance workflows or coupling permission logic to external claim management.

## 5. API Reference

All endpoints below, except /health, require Authorization: Bearer <firebase_id_token>.

### User Management

| Method | Endpoint | Roles Allowed | Description | Request Body (if any) |
|---|---|---|---|---|
| POST | /users/sync | viewer, analyst, admin | Creates local user on first login or returns existing user | { "firebase_uid": "...", "email": "...", "name": "..." } |
| GET | /users/me | viewer, analyst, admin | Returns authenticated user profile | None |
| GET | /users | admin | Lists all users | None |
| PATCH | /users/{id}/role | admin | Updates target user's role | { "role": "viewer|analyst|admin" } |
| PATCH | /users/{id}/status | admin | Updates target user's account status | { "status": "active|inactive" } |

### Financial Records

| Method | Endpoint | Roles Allowed | Description | Request Body (if any) |
|---|---|---|---|---|
| POST | /records | analyst, admin | Creates a financial record | { "amount": 120.50, "type": "income|expense", "category": "...", "date": "YYYY-MM-DD", "notes": "..." } |
| GET | /records | viewer, analyst, admin | Lists records with optional filters and pagination | Query: type, category, from_date, to_date, page, limit |
| GET | /records/{id} | viewer, analyst, admin | Returns one active record by id | None |
| PATCH | /records/{id} | analyst, admin | Partially updates a record | Any subset of amount, type, category, date, notes |
| DELETE | /records/{id} | admin | Soft-deletes a record by setting is_deleted=true | None |

### Dashboard

| Method | Endpoint | Roles Allowed | Description | Request Body (if any) |
|---|---|---|---|---|
| GET | /dashboard/summary | analyst, admin | Returns totals for income, expenses, net balance, and active record count | None |
| GET | /dashboard/by-category | analyst, admin | Returns grouped totals by category | None |
| GET | /dashboard/trends | analyst, admin | Returns monthly trend data (income, expenses, net) | Query: months (default 6) |
| GET | /dashboard/recent | viewer, analyst, admin | Returns most recent active records | Query: limit (default 10) |

## 6. Data Model

### users table

| Field | Type | Purpose |
|---|---|---|
| id | BIGSERIAL PRIMARY KEY | Internal user identifier used by application relations |
| firebase_uid | VARCHAR(128) UNIQUE NOT NULL | External identity bridge from Firebase at sync boundary |
| email | VARCHAR(255) UNIQUE NOT NULL | User email for identity and display |
| name | VARCHAR(150) NOT NULL | Human-readable display name |
| role | user_role ENUM NOT NULL DEFAULT 'viewer' | Authorization level for RBAC |
| status | user_status ENUM NOT NULL DEFAULT 'active' | Account lifecycle state used in access checks |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Last update timestamp |

### financial_records table

| Field | Type | Purpose |
|---|---|---|
| id | BIGSERIAL PRIMARY KEY | Record identifier |
| user_id | BIGINT NOT NULL (FK users.id) | Owner/creator reference |
| amount | NUMERIC(12,2) NOT NULL | Monetary value with fixed precision |
| type | record_type ENUM NOT NULL | Transaction direction: income or expense |
| category | VARCHAR(100) NOT NULL | Reporting label/category |
| date | DATE NOT NULL | Business date for filtering and trends |
| notes | TEXT NULL | Optional human notes |
| is_deleted | BOOLEAN NOT NULL DEFAULT FALSE | Soft delete marker |
| created_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ NOT NULL DEFAULT NOW() | Last update timestamp |

Soft delete was chosen so financial records are recoverable and auditable even after removal from normal views. Instead of deleting rows, the system marks records with is_deleted=true and excludes them from all active read and analytics queries.

DECIMAL/NUMERIC is used for amount because financial values must be exact. FLOAT introduces binary rounding behavior that can produce subtle inaccuracies in totals and derived analytics, which is unacceptable for financial reporting.

## 7. Setup and Running

### Prerequisites

- Git
- Python 3.10+
- Node.js 18+
- npm 9+
- PostgreSQL client tools (psql)
- Firebase project with Google Sign-In enabled
- Neon PostgreSQL database

### Backend setup

1. Clone and enter the repository.

```bash
git clone <your-repo-url>
cd Finance_Project
```

2. Create and activate a virtual environment.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

3. Install backend dependencies.

```bash
pip install -r requirements.txt
```

4. Configure backend environment variables.

```bash
cp .env.example .env
```

5. Run schema migration/setup against your database.

```bash
psql "$DATABASE_URL" -f schema.sql
```

6. Start the backend server.

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 7860
```

### Frontend setup

1. Install frontend dependencies.

```bash
cd ../frontend
npm install
```

2. Configure frontend environment variables.

```bash
cp .env.example .env.local
```

3. Start the frontend server.

```bash
npm run dev
```

### Environment variables

| Variable | Required | Description | Example Value |
|---|---|---|---|
| DATABASE_URL | Yes | Backend PostgreSQL connection string | postgresql://user:pass@host/db?sslmode=require |
| TEST_DATABASE_URL | Yes (for tests) | Dedicated database URL used only by pytest | postgresql://user:pass@host/finance_test?sslmode=require |
| FIREBASE_PROJECT_ID | Yes | Firebase project id for backend JWT verification | finance-dashboard-prod |
| FIREBASE_KEYS_TTL_SECONDS | No | In-memory cache TTL for Firebase public keys | 3600 |
| MIN_DB_CONNECTIONS | No | Minimum DB pool size | 1 |
| MAX_DB_CONNECTIONS | No | Maximum DB pool size | 10 |
| CORS_EXTRA_ORIGINS | No | Extra allowed origins for backend CORS | https://my-app.vercel.app |
| NEXT_PUBLIC_API_BASE_URL | Yes | Frontend target base URL for backend API | http://localhost:7860 |
| NEXT_PUBLIC_FIREBASE_API_KEY | Yes | Firebase web app API key | AIza... |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Yes | Firebase auth domain | your-app.firebaseapp.com |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Yes | Firebase project id for frontend SDK | finance-dashboard-prod |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Yes | Firebase storage bucket | finance-dashboard-prod.appspot.com |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Yes | Firebase messaging sender id | 123456789012 |
| NEXT_PUBLIC_FIREBASE_APP_ID | Yes | Firebase web app id | 1:123456789012:web:abcdef123456 |

## 8. Testing

Run the backend test suite from the backend directory after setting TEST_DATABASE_URL.

```bash
cd backend
pip install -r requirements-dev.txt
export TEST_DATABASE_URL="postgresql://user:pass@host/finance_test?sslmode=require"
pytest -q
```

The test suite is organized by behavior. test_auth.py validates authentication and account-status gate behavior, test_records.py validates access control plus record CRUD/filter/pagination behavior, test_dashboard.py validates aggregation correctness and role restrictions, and test_users.py validates user sync and admin user management behavior.

Firebase auth is handled in tests by overriding FastAPI's get_current_user dependency in fixtures so tests can simulate viewer, analyst, and admin identities without making live network calls to Firebase. This keeps tests deterministic, fast, and focused on API behavior while still preserving dedicated auth-path checks where needed.

## 9. Assumptions and Tradeoffs

### Assumptions

The system assumes every authenticated frontend request carries a valid Firebase ID token, because endpoint authorization depends on backend token verification before any business logic executes.

The default role for newly synced users is viewer, assuming that privilege escalation should be an explicit administrative action rather than an automatic consequence of login.

Analysts are assumed to need create and update permissions but not delete permissions, based on the operational expectation that destructive actions on finance data require a stricter approval boundary.

Soft delete is assumed to be mandatory for financial records so historical actions remain recoverable and auditable even when records are removed from active views.

Firebase public keys are assumed safe to cache in memory with refresh on verification failure, balancing security with latency in a serverless-like deployment context.

Category is assumed to be free text to support changing business labels without schema migrations, accepting that naming consistency is managed at the application/process level.

Pagination defaults are assumed to be page=1 and limit=20 as practical defaults for UI performance and API response size control.

### Tradeoffs

Using HuggingFace Spaces simplifies deployment but introduces cold-start behavior that can affect first-request latency, which is acceptable for assignment scope but not ideal for sustained production SLAs.

In-memory key caching reduces verification overhead but resets on restart, meaning production-grade reliability would benefit from an external cache like Redis to preserve key material across instances.

Storing roles in the application database provides full ownership of authorization policy, but requires careful synchronization between external identity and internal account lifecycle state.

Keeping category as free text increases flexibility and onboarding speed, while trading off strict normalization and potentially requiring future cleanup or migration to a dedicated categories table.

## 10. Design Decisions

The architecture deliberately separates HTTP routing, business logic, and persistence into routers, services, and schema/models. This separation of concerns keeps route handlers focused on transport concerns such as request parsing and status codes while making business rules testable in isolation and reusable across endpoints.

Authorization is implemented declaratively with require_roles() at route definition time. This makes access policy visible where endpoint behavior is declared, reduces hidden branching inside handler bodies, and simplifies security audits because permission intent is explicit and centralized.

The firebase_uid bridge pattern provides a clean boundary between external identity and internal authorization. Firebase handles who the user is, while the local users table controls what the user can do. This allows immediate role/status changes without relying on token-claim propagation and keeps provider-specific identity details from leaking into domain logic.

Dashboard analytics are implemented with SQL aggregation (SUM, GROUP BY, DATE_TRUNC) rather than application-side loops so computation runs close to the data. This improves performance for trend and summary queries, keeps API responses consistent with database truth, and avoids unnecessary memory transfer for large datasets.

Soft delete is integrated into service-layer query patterns so historical data remains recoverable while active views stay clean. This design aligns with financial data handling expectations where reversibility and auditability are often more important than physical deletion.

## 11. Known Limitations and What Would Change in Production

This implementation intentionally prioritizes assignment clarity over full production hardening, so it does not yet include advanced concerns such as distributed cache for Firebase keys, structured centralized error envelopes, observability instrumentation, rate limiting, idempotency safeguards, and migration/versioning workflows beyond schema bootstrap. In a production deployment, these would be added alongside stricter CI validation, managed secrets, infrastructure-level scaling controls, and stronger operational monitoring to support reliability, security, and compliance requirements at scale.
