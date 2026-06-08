# WarehouseAI — Fullstack AI Warehouse Management System

A production-grade WMS with AI demand forecasting, real-time inventory tracking, and Gemini-powered natural language insights.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL running locally

### 1. Configure Environment
Edit `.env.local` with your credentials:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/warehouse_db"
NEXTAUTH_SECRET="any-random-32-char-string"
GEMINI_API_KEY="your-gemini-api-key"  # from https://aistudio.google.com
AI_SERVICE_URL="http://localhost:8000"
```

### 2. Set Up Database
```bash
# Generate Prisma client + push schema + seed data
npm run db:setup
```

### 3. Start Python AI Service
```bash
cd python-ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Note:** Prophet installation may take a few minutes. If it fails, the app will fall back to an exponential smoothing model automatically.

### 4. Start Next.js App
```bash
npm run dev
```

Open http://localhost:3000

## 🔐 Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@warehouse.com | admin123 |
| Manager | manager@warehouse.com | manager123 |

## 📁 Project Structure
```
warehouse-ai/
├── app/
│   ├── (app)/           # Protected app pages (auth required)
│   │   ├── dashboard/   # KPI cards, charts
│   │   ├── inventory/   # Product table, CSV import
│   │   ├── orders/      # Purchase & sales orders
│   │   ├── forecasting/ # AI demand forecasting
│   │   └── alerts/      # Smart alerts
│   ├── api/             # API routes
│   └── login/           # Auth page
├── components/
│   ├── Sidebar.tsx      # Navigation sidebar
│   └── AIChat.tsx       # Gemini chat widget
├── python-ai/           # FastAPI + Prophet service
│   ├── main.py
│   ├── forecaster.py
│   └── requirements.txt
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

## 🤖 AI Features
- **Demand Forecasting**: Prophet ML model with 80% confidence intervals
- **Gemini Chat**: Natural language inventory queries with live DB context
- **Anomaly Detection**: IQR + Z-score hybrid on stock movements
- **Smart Alerts**: Auto-generated low stock / stockout risk warnings

## 📊 Tech Stack
- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- NextAuth.js v5
- Python FastAPI + Prophet
- Google Gemini API
- Recharts
