# WarehouseAI Deployment & Setup Guide

This guide details instructions on launching and managing the production-grade Warehouse Management System (WMS) with AI Demand Forecasting.

---

## Architectural Breakdown
The application is split into three core modules:
1. **Frontend**: Vite + React Single Page Application (Port `3000` inside Docker, port `5173` locally)
2. **Backend**: Node.js + Express TypeScript API server (Port `5000` inside Docker and locally)
3. **AI Service**: Python FastAPI microservice (Port `8000` inside Docker and locally)
4. **Database**: PostgreSQL database (Port `5432`)

---

## Method 1: Dockerized Deployment (Recommended)
Standing up the entire microservice stack requires only a single orchestrator command.

### Prerequisites
- Docker & Docker Compose installed on your system.

### Steps
1. Navigate to the project root:
   ```bash
   cd warehouse-ai
   ```
2. Build and run the containers in the background:
   ```bash
   docker compose up -d --build
   ```
3. To seed the database inside the running backend container:
   ```bash
   docker exec -it wms_backend npm run prisma:seed
   ```
4. Access the applications:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs (Swagger)**: [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
   - **Python AI microservice status**: [http://localhost:8000/](http://localhost:8000/)

---

## Method 2: Manual Local Startup
To run the services locally in development mode, follow these steps sequentially:

### 1. Database Setup
1. Ensure a local PostgreSQL server is running on port `5432`.
2. Create a database named `warehouse_db` (or matching your `.env` connection string).
3. The root `.env` config should resemble:
   ```text
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/warehouse_db"
   NEXTAUTH_SECRET="warehouse-ai-super-secret-key-2024-change-me"
   GEMINI_API_KEY="AQ.Ab8...YourKey"
   AI_SERVICE_URL="http://localhost:8000"
   ```

### 2. Express Backend Startup
1. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```
2. Run database migrations and generate the Prisma Client:
   ```bash
   npx prisma generate
   npx prisma db push --accept-data-loss
   ```
3. Seed the PostgreSQL tables:
   ```bash
   npm run prisma:seed
   ```
4. Start the Express development server (runs with hot reloading on port 5000):
   ```bash
   npm run dev
   ```

### 3. Python AI Microservice Startup
1. Open a terminal in `ai-service/`:
   ```bash
   cd ai-service
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the FastAPI application on port 8000:
   ```bash
   python main.py
   ```

### 4. React Frontend Startup
1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   ```
2. Install node dependencies:
   ```bash
   npm install
   ```
3. Boot the Vite development server (runs on port 5173):
   ```bash
   npm run dev
   ```

---

## Core API Endpoints

### Authentication
- `POST /api/auth/login` - Public credentials login (returns JWT).
- `POST /api/auth/register` - Register a new user (Admin authorization required).
- `GET /api/auth/me` - Profile lookup (JWT required).

### Products & Inventory
- `GET /api/products` - List all products with paginated metrics.
- `POST /api/products` - Create a product and automatically generate a new SKU.
- `POST /api/products/adjust-stock` - Adjust stock counts inside a warehouse and assign aisle, shelf, and bin coords.

### Order Fulfillment
- `POST /api/orders` - Generate Inbound PO or Outbound SO.
- `PUT /api/orders/:id/status` - Transition order states. If set to `DELIVERED`, stock counts are recalculated instantly.

### AI Forecasting & Chatbot
- `POST /api/forecasting/trigger` - Send historical sales to FastAPI, calculate 30/60/90 predictions, and cache ROP safety volumes.
- `GET /api/forecasting/reorder-recommendations` - Fetch low stock items and auto reorder estimates.
- `POST /api/chatbot` - Ask natural language questions with injected RAG database contexts.
