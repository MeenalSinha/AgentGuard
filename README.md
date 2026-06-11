# AgentGuard — The AI That Watches Your AI

A production-grade AI observability and reliability platform for monitoring deployed AI agents.

## Architecture

```
agentguard/
├── frontend/          # Next.js 15 App Router + TypeScript + Tailwind
├── backend/           # FastAPI + Python
├── infra/             # Docker Compose, Kubernetes, Terraform
└── docs/              # Architecture and API documentation
```

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7

### Development Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/agentguard
cd agentguard

# 2. Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# 3. Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 4. Frontend
cd ../frontend
npm install
cp .env.example .env.local
npm run dev
```

### Environment Variables

See `backend/.env.example` and `frontend/.env.example`.

## Feature Overview

| Feature | Description |
|---------|-------------|
| Agent Monitoring | Real-time metrics per agent |
| Drift Detection | Prompt, model, retrieval, intent drift |
| Hallucination Detection | Automated output analysis |
| Root Cause Analysis | AI-driven failure investigation |
| Incident Timeline | Chronological event tracking |
| Trust Score | Proprietary 0-100 reliability score |
| Failure Prediction | ML-based degradation forecasting |
| AI Copilot | Chat interface for investigations |
| Executive Dashboard | ROI and governance reports |

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Recharts, Zustand
- **Backend**: FastAPI, SQLAlchemy, Celery, Redis
- **AI**: Google Gemini 2.5, LangGraph
- **Observability**: Arize Phoenix
- **Database**: PostgreSQL
- **Auth**: Clerk
- **Deployment**: Google Cloud Run, Docker

## License

MIT
