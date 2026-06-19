# Chosen Motion

Chosen Motion is a premium, full-stack motion tracking platform built for clinical and athletic settings. The platform allows Patients to record, log, and view their motion tracking sessions, while Admins (clinicians/coaches) can analyze session data, monitor patient compliance, and view aggregated performance metrics.

## Architecture Overview

The platform uses a modern, production-ready decoupled architecture:

```mermaid
graph TD
    Client[React Frontend - Vite/TS/Tailwind] -->|HTTPS / WSS| Backend[FastAPI Backend - Python 3.12]
    Client -->|Auth / Identity| Supabase[Supabase Authentication]
    Backend -->|Verify Token| Supabase
    Backend -->|Read/Write| Postgres[(PostgreSQL Database)]
```

### Technologies

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router DOM, Supabase JS Client, Lucide Icons.
* **Backend**: FastAPI, Python 3.12, SQLAlchemy (ORM), Alembic (Migrations), PyJWT (token verification).
* **Database**: PostgreSQL 15.
* **Identity & Access**: Supabase Auth (JWT token-based authentication).
* **Orchestration**: Docker & Docker Compose.

---

## Directory Structure

```text
chosen-motion/
├── docker-compose.yml           # Multi-container orchestration
├── README.md                    # Project documentation
├── scripts/                     # Local developer setup & runner scripts
│   ├── setup-dev.bat            # Windows setup script
│   └── start-dev.bat            # Windows development runner
├── backend/                     # Python 3.12 FastAPI Application
│   ├── app/
│   │   ├── api/                 # Endpoint routing (v1)
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/   # Admin, patient, and auth routers
│   │   │   │   └── router.py    # Main API router setup
│   │   ├── core/                # DB, config, security setup
│   │   │   ├── config.py        # Settings loader via pydantic-settings
│   │   │   ├── database.py      # SQLAlchemy session & engine
│   │   │   └── security.py      # Supabase auth middleware dependencies
│   │   ├── models/              # SQLAlchemy model definitions
│   │   │   └── models.py
│   │   ├── schemas/             # Pydantic schema serializers
│   │   │   └── schemas.py
│   │   └── main.py              # Application entrypoint
│   ├── Dockerfile               # Backend production multi-stage Dockerfile
│   ├── requirements.txt         # Pip package requirements
│   └── .env.example             # Backend environment template
└── frontend/                    # Vite + React + TypeScript Frontend
    ├── src/
    │   ├── assets/              # Static media files
    │   ├── components/          # Reusable components
    │   │   ├── ui/              # Atom level UI elements (buttons, inputs)
    │   │   └── layout/          # Page layouts, navbar, sidebars
    │   ├── context/             # Global contexts (AuthContext)
    │   ├── features/            # Feature directories grouped by domains
    │   │   ├── admin/           # Admin pages, charts, tables
    │   │   ├── patient/         # Patient pages, charts, session records
    │   │   ├── auth/            # Auth forms (login, register)
    │   │   └── motion-tracking/ # Motion tracking view skeleton
    │   ├── hooks/               # Custom react hooks
    │   ├── lib/                 # Core libraries (Supabase client init)
    │   ├── routes/              # AppRouter and role guards
    │   ├── services/            # API services integration
    │   ├── types/               # Shared TS declarations
    │   ├── utils/               # Formatters, mathematics, math-helpers
    │   ├── App.tsx              # Root component
    │   ├── index.css            # Tailwind directives & design system overrides
    │   └── main.tsx             # Application entrypoint
    ├── Dockerfile               # Frontend Nginx production Dockerfile
    ├── package.json             # NPM scripts and packages
    ├── postcss.config.js        # PostCSS configurations
    ├── tailwind.config.js       # Core design guidelines, colors, spacing
    ├── tsconfig.json            # TypeScript rules
    ├── vite.config.ts           # Vite compile/alias configs
    └── .env.example             # Frontend environment template
```

---

## Environment Configuration

Before running, configure environment variables for both services:

### Backend Configuration (`/backend/.env`)
Copy `backend/.env.example` to `backend/.env` and configure:
```env
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/chosen_motion
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-supabase-jwt-secret-from-dashboard
ENVIRONMENT=development
```

### Frontend Configuration (`/frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env` and configure:
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-from-dashboard
```

---

## Running the Project

### Method 1: Docker Compose (Recommended for Production/Orchestrated Local Runs)
Simply run:
```bash
docker compose up --build
```
This builds and boots up:
* Postgres at `localhost:5432`
* FastAPI Backend at `localhost:8000` (docs available at `/docs`)
* React Frontend at `localhost:3000`

### Method 2: Local Development Mode (Recommended for Hot-Reloading)
1. **Setup dependencies**:
   Run the setup script:
   ```cmd
   .\scripts\setup-dev.bat
   ```
   *Note: This creates a Python virtual environment (`.venv`) inside the backend directory, installs dependencies, and runs `npm install` inside the frontend.*

2. **Run dev servers**:
   Run the start script:
   ```cmd
   .\scripts\start-dev.bat
   ```
   *This concurrently spins up the FastAPI backend on port 8000 and the Vite frontend on port 5173 (standard Vite port).*
