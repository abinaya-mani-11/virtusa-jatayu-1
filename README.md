
## Getting Started

### Prerequisites

- **Python:** 3.10, 3.11, 3.12, 3.13, or 3.15.
- **Node.js:** v18+ or v20+.
- **uv (recommended):** Fast Python package manager (or standard `pip`).

---

### Backend Setup

1. **Navigate to the backend directory and activate the virtual environment:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   # Using uv:
   uv pip install -r requirements.txt

   # Or using standard pip:
   pip install -r requirements.txt
   ```

3. **Start the FastAPI backend server:**
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

   The backend will launch at `http://127.0.0.1:8000`.
   - Interactive Swagger API docs: `http://127.0.0.1:8000/docs`
   - Health check: `http://127.0.0.1:8000/api/health`

---

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```

   The web interface will launch at `http://localhost:5173`.

---
