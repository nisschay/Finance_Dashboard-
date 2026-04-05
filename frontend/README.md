# Finance Dashboard Frontend

Next.js + TypeScript frontend for the Finance Dashboard backend.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env.local
```

3. Run development server:

```bash
npm run dev
```

## Required env vars

- NEXT_PUBLIC_API_BASE_URL
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID

## Pages

- /login
- /dashboard
- /records

## Features

- Firebase Google Sign-In
- Auto sync to backend via POST /users/sync
- Authenticated API client with Bearer token
- Dashboard analytics panels
- Records list with filters
- Add record modal
- Navbar role display from /users/me
