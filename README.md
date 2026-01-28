# Unolo Field Force Tracker

A web application for tracking field employee check-ins at client locations.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, Express.js, SQLite
- **Authentication:** JWT

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm run setup    # Installs dependencies and initializes database
cp .env.example .env
npm run dev
```

Backend runs on: `http://localhost:3001`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

### Test Credentials

| Role     | Email              | Password    |
|----------|-------------------|-------------|
| Manager  | manager@unolo.com | password123 |
| Employee | rahul@unolo.com   | password123 |
| Employee | priya@unolo.com   | password123 |

---

## Features Implemented

### Distance Calculation (Feature A)
- When an employee checks in, the system calculates the distance between their current GPS location and the client's registered location using the **Haversine formula**
- Distance is displayed in kilometers (rounded to 2 decimal places)
- If distance > 0.5 km, a **warning is shown** on the check-in form
- Distance is stored in the database and displayed in the attendance history table

### Daily Summary Report (Feature B)
- New API endpoint for managers to view team activity summaries
- Aggregates check-ins, hours worked, and clients visited per employee
- Efficient SQL queries (no N+1 problem)

---

## Project Structure

```
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes (auth, checkin, dashboard, reports)
│   ├── scripts/         # Database init scripts
│   └── server.js        # Express app entry
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── utils/       # API helpers
│   └── index.html
├── database/            # SQL schemas (reference only)
├── BUG_FIXES.md         # Documentation of all bugs fixed
├── QUESTIONS.md         # Technical question answers
└── RESEARCH.md          # Real-time tracking research
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |
| GET | `/api/auth/me` | Get current user profile |

### Check-ins
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/checkin/clients` | Get assigned clients for employee |
| POST | `/api/checkin` | Create check-in (returns `distance_from_client`) |
| PUT | `/api/checkin/checkout` | Checkout from current location |
| GET | `/api/checkin/history` | Get check-in history with optional date filters |
| GET | `/api/checkin/active` | Get currently active check-in |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Manager stats (team overview) |
| GET | `/api/dashboard/employee` | Employee stats (personal overview) |

### Reports (NEW)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily-summary` | Daily team summary (manager only) |

---

## New API: Daily Summary Report

**Endpoint:** `GET /api/reports/daily-summary`

**Authentication:** Bearer token (manager only)

**Query Parameters:**
| Parameter | Required | Description |
|-----------|----------|-------------|
| `date` | Yes | Date in YYYY-MM-DD format |
| `employee_id` | No | Filter to specific employee |

**Example Request:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/reports/daily-summary?date=2024-01-15"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "team_summary": {
      "total_employees": 3,
      "employees_checked_in": 2,
      "total_checkins": 5,
      "total_hours_worked": 12.5,
      "unique_clients_visited": 4
    },
    "employee_breakdown": [
      {
        "employee_id": 2,
        "employee_name": "Rahul Kumar",
        "employee_email": "rahul@unolo.com",
        "total_checkins": 3,
        "clients_visited": 3,
        "hours_worked": 6.5
      }
    ]
  }
}
```

**Error Responses:**
- `400` - Missing or invalid date format
- `403` - Non-manager trying to access

---

## Architecture Decisions

1. **Haversine on both backend and frontend** - Backend calculates and stores distance for historical accuracy; frontend calculates for immediate preview before submission.

2. **SQLite for simplicity** - No external database setup required. For production, recommend migrating to PostgreSQL.

3. **Efficient SQL aggregations** - The daily summary report uses JOINs and GROUP BY in a single query to avoid N+1 problems.

4. **Parameterized queries everywhere** - All user input is properly escaped to prevent SQL injection.



---

## Notes

- Run `npm run init-db` to reset the database to initial state
- The database uses SQLite - no external database installation required
