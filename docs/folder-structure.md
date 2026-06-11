# AgentGuard — Complete Folder Structure

```
agentguard/
│
├── README.md                          # Project overview & quick start
│
├── frontend/                          # Next.js 15 App
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── middleware.ts                  # Clerk auth protection
│   ├── .env.example
│   │
│   ├── styles/
│   │   └── globals.css                # Tailwind + custom CSS vars
│   │
│   ├── lib/
│   │   ├── api.ts                     # Axios API client (all endpoints)
│   │   └── utils.ts                   # cn(), formatters, color helpers
│   │
│   ├── store/
│   │   └── useStore.ts                # Zustand global state
│   │
│   └── app/                           # Next.js App Router
│       ├── layout.tsx                 # Root layout (ClerkProvider)
│       ├── page.tsx                   # Landing page (hero, features, CTA)
│       │
│       ├── sign-in/[[...sign-in]]/
│       │   └── page.tsx               # Clerk sign-in
│       ├── sign-up/[[...sign-up]]/
│       │   └── page.tsx               # Clerk sign-up
│       │
│       └── dashboard/
│           ├── layout.tsx             # Sidebar + top nav shell
│           ├── page.tsx               # Overview dashboard (KPIs, charts, feed)
│           ├── agents/
│           │   ├── page.tsx           # Agent table with filters
│           │   └── [id]/
│           │       └── page.tsx       # Agent detail (tabs, charts, radar)
│           ├── drift/
│           │   └── page.tsx           # Drift events + radar + bar chart
│           ├── hallucinations/
│           │   └── page.tsx           # Hallucination list + detail panel
│           ├── incidents/
│           │   └── page.tsx           # Incident list + timeline + RCA
│           ├── predictions/
│           │   └── page.tsx           # ML forecast charts
│           ├── copilot/
│           │   └── page.tsx           # AI chat (Gemini-powered)
│           ├── executive/
│           │   └── page.tsx           # ROI charts + governance scores
│           ├── governance/
│           │   └── page.tsx           # Compliance checks + audit trail
│           └── settings/
│               └── page.tsx           # Alerts, integrations, API keys, team
│
├── backend/                           # FastAPI Python App
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── .env.example
│   │
│   ├── migrations/
│   │   └── env.py                     # Alembic async migration env
│   │
│   └── app/
│       ├── main.py                    # FastAPI app + lifespan + CORS
│       ├── __init__.py
│       │
│       ├── core/
│       │   ├── config.py              # Pydantic settings (env vars)
│       │   ├── database.py            # SQLAlchemy async engine + session
│       │   ├── cache.py               # Redis async cache helpers
│       │   ├── celery.py              # Celery app + beat schedule
│       │   └── logging.py             # Structlog configuration
│       │
│       ├── models/
│       │   └── models.py              # SQLAlchemy ORM models:
│       │                              #   Agent, AgentMetric, DriftEvent,
│       │                              #   HallucinationEvent, Incident,
│       │                              #   Prediction, Recommendation
│       │
│       ├── schemas/
│       │   └── schemas.py             # Pydantic request/response schemas
│       │
│       ├── api/
│       │   └── v1/
│       │       ├── router.py          # Includes all sub-routers
│       │       ├── agents.py          # CRUD + metrics endpoints
│       │       ├── dashboard.py       # KPIs, rankings, live feed
│       │       ├── drift.py           # Drift events + summary
│       │       ├── hallucinations.py  # Hallucination events
│       │       ├── incidents.py       # Incidents + detail
│       │       ├── predictions.py     # ML predictions
│       │       ├── copilot.py         # Gemini chat + streaming
│       │       ├── recommendations.py # Recommendations + apply
│       │       └── observability.py   # Phoenix proxy + status
│       │
│       ├── services/
│       │   └── __init__.py            # (drift_service.py, prediction_service.py
│       │                              #  hallucination_service.py go here)
│       │
│       ├── observability/
│       │   └── phoenix.py             # Arize Phoenix OTLP init
│       │
│       └── scripts/
│           └── seed_demo_data.py      # Seeds 20 agents + 30 days of data
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml         # postgres, redis, phoenix, backend, celery
│   │
│   ├── k8s/
│   │   └── cloud-run.yaml             # Google Cloud Run deployment config
│   │
│   └── terraform/                     # (Terraform configs go here)
│
└── docs/
    ├── architecture.md                # Full system architecture + API reference
    └── folder-structure.md            # This file
```

## Key Design Decisions

### Dark Design System
Colors: black (#0a0a0a base), lime green (#a3e635 primary accent), orange (#f97316 warning accent)
Inspired by the reference image with dark cards, accent color highlights, data-dense layouts.

### Frontend ↔ Backend Connection
- `frontend/lib/api.ts` defines all Axios clients pointing to `NEXT_PUBLIC_API_URL`
- Next.js rewrites proxy `/api/backend/*` → FastAPI
- SWR hooks fetch and cache all live data with 30-60s revalidation
- Demo data fallbacks ensure the UI works without a running backend

### Authentication Flow
1. User lands on `/` (public)
2. Clicks "Start Monitoring" → redirected to `/sign-up` (Clerk)
3. After auth → redirected to `/dashboard`
4. `middleware.ts` protects all `/dashboard/*` routes via Clerk JWT
5. Backend validates Clerk JWT on protected API endpoints

### Data Architecture
- PostgreSQL stores all historical data (agents, metrics, events, incidents)
- Redis caches hot paths: dashboard KPIs (30s TTL), rankings (60s), agent lists (60s)
- Celery workers run background scans every 60s; predictions refresh hourly
- Arize Phoenix receives OTLP traces from every agent invocation

## Quick Commands

```bash
# Backend setup
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with your keys

# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d postgres redis phoenix

# Run migrations and seed
alembic upgrade head
python -m app.scripts.seed_demo_data

# Start API
uvicorn app.main:app --reload --port 8000

# Frontend setup
cd frontend
npm install
cp .env.example .env.local
# edit .env.local with your Clerk keys

# Start dev server
npm run dev
# Open http://localhost:3000
```
