# FredRec

A place to find good free resources for learning Computer Science.

## Problem statement

There is a lot of free material online for learning Computer Science (YouTube lectures, NPTEL and MIT OCW courses, open textbooks, papers, GitHub repos), but it is scattered across many sites and the quality varies a lot. A student who wants to learn something like "Operating Systems" or "Dynamic Programming" usually ends up opening ten tabs and still isn't sure what's worth their time.

FredRec puts all of this in one place. You search for a CS topic and it collects free resources from 12 sources plus our own scraped NPTEL / MIT OCW data, removes duplicates and ranks them. Domain experts review and recommend resources, so trusted ones show up first. Learners can save resources into workspaces, track their progress, rate what they used, and share workspaces with their team.

Team: Amey Dhoke, Sumit Chavan, Piyush Malkhede.

---

## Code organization

```
FredRec/
├── backend/     FastAPI server, database models, search, scrapers
└── frontend/    React + TypeScript web app (Vite, Tailwind)
```

### Backend (`backend/`)

Python 3.12+, FastAPI, SQLAlchemy, PostgreSQL (we use Neon) with the pgvector extension.

| File / folder | What it does |
|---|---|
| `pyproject.toml` | Python dependencies of the backend |
| `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako` | Alembic setup for database migrations |
| `alembic/versions/0001_initial_schema.py` | Users, domains, topics, resources, suggestions, reviews, progress, teams, workspaces |
| `alembic/versions/0002_search_cache.py` | Table used to cache answers from the search APIs |
| `alembic/versions/0003_concept_graph_and_vector_search.py` | pgvector, concept graph tables, search log, embedding columns |
| `alembic/versions/0004_web_scraping.py` | Tables for scraped items and scrape runs |
| `alembic/versions/0005_topic_descriptions_and_phrases.py` | Topic descriptions and topic phrases (used for better topic matching) |
| `data/topics.yaml` | The starting 12 domains and 75 topics with their aliases |
| `data/topic_descriptions.yaml` | A short syllabus for every topic, used for meaning based search |
| `app/main.py` | Creates the FastAPI app, registers all the routers, error handling |
| `app/cli.py` | Command line tools: `create-admin`, `seed-domains`, `scrape`, `embed-all`, `prune-cache`, `prune-search-log` |

**`app/core/`** – shared setup

| File | What it does |
|---|---|
| `config.py` | Reads settings from `backend/.env` (database URL, JWT secret, API keys, thresholds) |
| `db.py` | Database engine and sessions |
| `security.py` | Password hashing (Argon2) and login tokens (JWT) |
| `validation.py` | Rules for usernames, emails, passwords and names |
| `embeddings.py` | Loads the bge-small embedding model through fastembed and turns text into vectors |

**`app/models/`** – database tables

| File | What it does |
|---|---|
| `base.py` | Base class and all the enums (roles, formats, statuses, difficulty etc.) |
| `tables.py` | All 21 tables as SQLAlchemy models |
| `__init__.py` | Exports the models |

**`app/schemas/`** – request / response shapes (Pydantic) for each part of the API: `auth.py`, `admin.py`, `concepts.py`, `resources.py`, `search.py`, `stats.py`, `submissions.py`, `teams.py`, `workspaces.py`

**`app/api/`** – the REST API

| File | What it does |
|---|---|
| `deps.py` | Gets the logged in user from the token and checks roles (learner / expert / admin) |
| `routes/auth.py` | Sign up, login, current user, change password |
| `routes/domains.py` | Public list of domains and topics |
| `routes/admin.py` | Admin: manage domains, topics and expert accounts, admin dashboard numbers |
| `routes/expert.py` | Expert: their domains and the expert dashboard numbers |
| `routes/submissions.py` | Suggesting a resource and the review flow (learner → expert → admin → published) |
| `routes/search.py` | The search endpoint |
| `routes/workspaces.py` | Personal workspaces: create, rename, delete, add and remove resources |
| `routes/teams.py` | Teams, members and roles, invites, team workspaces |
| `routes/feedback.py` | Progress tracking and ratings |
| `routes/concepts.py` | Concept graph: view, add/rename/delete concepts, add/remove links |

**`app/services/`** – the actual logic behind the routes

| File | What it does |
|---|---|
| `search.py` | Runs a search from start to end: match topic, collect results, rank, log |
| `matching.py` | Figures out which topic or concept a query is about (exact name, alias or by meaning) |
| `ranking.py` | Removes duplicates and ranks results (relevance, popularity, recency) |
| `search_cache.py` | Small cache stored in Postgres so we don't hit the API limits |
| `scraped_search.py` | Searches our scraped NPTEL / MIT OCW / TYCS items |
| `scraping.py` | Runs a scraper and saves / updates / removes the scraped items |
| `concepts.py` | Concept graph rules (who can edit, no loops, parent topic of a concept) |
| `embedding_text.py` | Decides what text gets embedded for topics, concepts and resources |
| `resources.py` | Saving a resource once and reusing it everywhere |
| `workspaces.py` | Workspace access checks (owner / editor / viewer) |
| `stats.py` | Queries for the admin and expert dashboards |
| `urls.py` | Cleans up links so the same link is detected even if written differently |
| `demo_source.py` | Placeholder results, used only when `SEARCH_DEMO=true` (for working offline) |

**`app/connectors/`** – one file per free search source. `base.py` has the common part, the rest are the sources: `youtube.py`, `arxiv.py`, `openalex.py`, `semantic_scholar.py`, `core.py`, `open_library.py`, `google_books.py`, `wikibooks.py`, `internet_archive.py`, `devto.py`, `github.py`, `mit_learn.py`

**`app/scrapers/`** – scrapers for sites that don't have an API

| File | What it does |
|---|---|
| `base.py` | Common shape of a scraper and of a scraped record |
| `fetcher.py` | Polite HTTP client: follows robots.txt, waits between requests, backs off when the site is busy |
| `devalue.py` | Decoder for the data format NPTEL's pages use |
| `nptel.py` | NPTEL courses and lectures |
| `mit_ocw.py` | MIT OpenCourseWare courses |
| `tycs.py` | Teach Yourself CS recommendations |

**`experiments/`** – scripts we used to pick the similarity thresholds (`calibrate.py`, `compare_topic_text.py`) and the labelled test queries (`queries.yaml`). Not needed to run the app.

### Frontend (`frontend/`)

React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Flow (concept graph), Recharts (dashboards).

| File / folder | What it does |
|---|---|
| `package.json`, `package-lock.json` | Dependencies and npm scripts |
| `vite.config.ts` | Vite setup, sends `/api` requests to the backend on port 8000 |
| `index.html`, `public/favicon.svg` | Page shell and icon |
| `tsconfig*.json`, `.oxlintrc.json` | TypeScript and linter settings |
| `src/main.tsx` | Entry point, sets up React Query, auth and the router |
| `src/App.tsx` | All the routes / pages |
| `src/index.css` | Tailwind and our colour theme |
| `src/theme.ts` | Light / dark mode |

**`src/api/`** – functions that call the backend. `client.ts` is the common fetch wrapper (adds the login token, handles errors). The others match the backend parts: `auth.ts`, `search.ts`, `domains.ts`, `submissions.ts`, `workspace.ts`, `teams.ts`, `admin.ts`, `stats.ts`, `concepts.ts`

**`src/pages/`**

| File | Page |
|---|---|
| `HomePage.tsx` | Landing page with search bar and popular topics |
| `SearchPage.tsx` | Search results with filters |
| `TopicsPage.tsx` | All domains and topics |
| `LoginPage.tsx`, `SignupPage.tsx`, `ChangePasswordPage.tsx` | Accounts |
| `WorkspacesPage.tsx`, `WorkspaceDetailPage.tsx` | List of workspaces, one workspace with progress |
| `TeamsPage.tsx`, `TeamDetailPage.tsx` | Teams, invites, members, team workspaces |
| `SuggestPage.tsx`, `SuggestionsPage.tsx` | Suggest a resource, and your suggestions with their status |
| `ExpertPage.tsx` | Expert review queue and expert dashboard |
| `ConceptGraphPage.tsx` | Concept map editor for a domain |
| `AdminPage.tsx` + `admin/` | Admin tabs: `OverviewTab` (dashboard), `ApprovalsTab`, `CuratedTab`, `DomainsTab`, `ExpertsTab` |
| `NotFoundPage.tsx` | 404 page |

**`src/components/`** – reusable pieces: `Layout` (navbar), `SearchBar`, `ResourceCard`, `SaveToWorkspaceDialog`, `WorkspaceItemRow`, `ReviewCard` / `ReviewForm` (reviewing suggestions), `SubmissionTimeline`, `StatusBadge`, `DifficultyPicker`, `DomainCheckboxes`, `FilterChip`, `ExpertOverview`, `AuthCard`, `Loader`, `ThemeToggle`, `RequireAuth` / `RequireRole` (protect pages), `styles.ts` (shared class names), `charts/` (chart parts and colours)

**Other folders in `src/`**
- `context/` – logged in user (`AuthContext.tsx`, `useAuth.ts`)
- `hooks/` – React Query keys and the domains hook
- `types/` – TypeScript types for resources, suggestions, teams, concepts, stats
- `lib/graphLayout.ts` – arranges the concept graph automatically (dagre)
- `data/topics.ts` – short forms for topics in the search bar (e.g. "dp" → Dynamic Programming)

---

## How to run

You need:
- **Python 3.12 or newer**
- **Node.js 20 or newer** (comes with npm)

These steps are for Linux and macOS.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

Start the server:

```bash
uvicorn app.main:app --reload
```

The API runs on http://localhost:8000 (API docs at http://localhost:8000/docs). The first time it starts, it downloads the embedding model (about 70 MB) into `backend/.cache`, so the first start takes a bit longer.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The frontend sends all `/api` calls to the backend on port 8000, so keep the backend running.

To make a production build instead: `npm run build` (output goes to `frontend/dist`).

### Accounts

You can sign up as a new learner from the website, or use these existing accounts:

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Domain expert | `expert1` | `expert@123` |
| Learner | `user1` | `user1234` |

New experts are created by the admin from the Admin page. They get a temporary password and have to change it on first login.
