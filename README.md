# Aura Wealth (Electro Treasur)

Aura Wealth is a premium, gamified financial "Future Management System" and wealth tracker. It's built with an Apple-style Fintech design language, deep frontend reactivity, Gamification elements, and a robust microservices-ready architecture using FastAPI and PostgreSQL.

## 🌟 Key Features

*   **Premium "Glassmorphic" UI**: An immersive dark/light mode React application featuring advanced design aesthetics (Mesh gradients, blur layers, refined typography).
*   **"Precision Lock" Layout**: Hand-crafted Apple-style Fintech layouts built with Tailwind CSS, Framer Motion, and absolute focus on geometric accuracy and aesthetic excellence.
*   **Intelligent Dashboard**: Features high-fidelity Data Metrics (Total Capital, Income, Expense flows), interactive charts, and Gamified growth indicators.
*   **Gamified Gamification Center (Future Management)**: Engage with habit-tracker capabilities tailored for micro-transactions, increasing financial safety levels and "Days of Freedom".
*   **Zero-G Backend Security**: Secure FastAPI application powered by fully typed `pydantic` models, isolated user contexts, JWT Auth, Redis-based throttling, and comprehensive telemetry (Structured Logging + Exception Shields).
*   **Instant Reactivity**: End-to-end integration with `react-query`, enabling optimistic UI updates and zero-delay transaction entry without screen reloads.
*   **Fully Dockerized**: Development and deployment orchestrated via standard `docker-compose.yml`.

## 🛠 Tech Stack

### Frontend
*   **React 18** (Vite + TypeScript)
*   **Tailwind CSS V3**
*   **Framer Motion** (for staggering reveals & micro-animations)
*   **TanStack Query** (Data fetching & mutations)
*   **Lucide React** (Consistent iconography)
*   `react-phone-number-input` & `recharts`

### Backend
*   **FastAPI** (Python 3.11+)
*   **SQLAlchemy** (Async queries)
*   **PostgreSQL 15** 
*   **Redis**
*   **Alembic** (DB Migrations)
*   **Pytest & Hypothesis** (For property-based and integration testing)

### DevOps
*   Docker & Docker Compose
*   Kubernetes ready manifests (`/k8s`)
*   Load Testing suite (`/load_testing`)

## 🚀 Getting Started

### Prerequisites

Ensure you have Docker and Docker Compose installed on your local machine.

### Setup and Running

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JeffreyWillims/electro-treasur.git
   cd electro-treasur
   ```

2. **Boot the complete stack:**
   ```bash
   docker-compose up -d --build
   ```

3. **Database Migration:**
   ```bash
   # Enter the backend container and apply migrations
   docker-compose exec backend bash
   alembic upgrade head
   ```

4. **Access the Application**:
   *   **Frontend**: Navigate to `http://localhost:4000` (by default Vite serves on 4000 or 5173 depending on your config).
   *   **Backend API Docs**: Navigate to `http://localhost:8000/docs` to see the full Swagger UI.

## 🤝 Project Structure

```
├── backend/
│   ├── src/                 # Main FastAPI application logic (routes, schemas, models)
│   ├── migrations/          # Alembic migrations for PostgreSQL
│   ├── tests/               # Pytest suite
│   ├── requirements.txt     # Python Dependencies
├── frontend/
│   ├── src/
│   │   ├── api/             # React Query API fetchers
│   │   ├── components/      # Feature-specific, layout, and UI components
│   │   ├── context/         # AuthContext
│   │   └── App.tsx          # Application Routes & Config
│   ├── tailwind.config.js
│   ├── package.json
├── k8s/                     # Kubernetes deployment configurations
├── load_testing/            # Artillery or Locust scripts
├── docker-compose.yml       # Complete stack configuration
```

## ⚖️ License

All rights reserved. 
