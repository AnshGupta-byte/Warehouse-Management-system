<div align="center">

<img src="https://img.shields.io/badge/WarehouseAI-v2.0-6366f1?style=for-the-badge&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL-15-4169e1?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/Gemini-2.0%20Flash-8b5cf6?style=for-the-badge&logo=google&logoColor=white" />

<br/><br/>

# 🏭 WarehouseAI — Intelligent Warehouse Management System

### A production-grade, AI-powered WMS with demand forecasting, spatial heatmaps, barcode scanning, and a real-time AI chatbot assistant

<br/>

[🚀 Quick Start](#-quick-start) • [✨ Features](#-features) • [🏗️ Architecture](#️-architecture) • [📸 Screenshots](#-feature-walkthrough) • [🔌 API Reference](#-api-reference) • [🤝 Contributing](#-contributing)

</div>

---

## 📌 What is WarehouseAI?

**WarehouseAI** is a full-stack, AI-integrated Warehouse Management System built for modern logistics teams. It combines a powerful inventory engine with a Python AI microservice to deliver:

- 📦 **Real-time stock tracking** across multiple warehouses with spatial bin-level precision
- 🧠 **AI demand forecasting** using XGBoost — predict the next 30, 60, and 90 days of demand with confidence scores
- 🗺️ **Spatial heatmaps** — visualize floor-space utilization per aisle and shelf
- 🤖 **Gemini-powered chatbot** — ask natural language questions about your warehouse
- 📊 **ABC inventory classification** — automatically classify products by annual usage value
- 🔔 **Real-time alerts** — WebSocket-driven low-stock and reorder push notifications

---

## ✨ Features

<details open>
<summary><strong>🔐 Authentication & Role-Based Access Control</strong></summary>
<br/>

| Role | Access |
|------|--------|
| **Admin** | Full access — User management, all CRUD, system config |
| **Manager** | Inventory, Orders, Forecasting, Analytics |
| **Staff** | View inventory, process order status updates |

- JWT-based stateless authentication
- Per-route middleware guards with `protect`, `adminOnly`, `managerOrAbove`
- Session persistence via `localStorage`

</details>

<details>
<summary><strong>📦 Inventory Management</strong></summary>
<br/>

- Add, edit, and delete products with **auto-generated SKUs**
- Assign products to specific warehouse **aisle → shelf → bin** locations
- **Drag-and-drop CSV bulk import** (name, category, price, quantity, location)
- **Barcode scanner** — scan real barcodes via device camera (Code128, EAN-13, UPC, QR)
- Real-time stock level updates pushed via WebSocket
- Color-coded **low-stock alerts** per product

</details>

<details>
<summary><strong>🏭 Warehouse & Spatial Management</strong></summary>
<br/>

- Create and manage multiple warehouse locations
- **Interactive floor heatmap** — 5×5 aisle/shelf grid colored by utilization density
- Click any grid cell to inspect bin contents, stored products, and occupancy %
- Bin-level stock assignment with coordinates

</details>

<details>
<summary><strong>📋 Order Management</strong></summary>
<br/>

- Create purchase/sales orders linked to products and warehouses
- Track order lifecycle: `PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`
- Attach tracking numbers and shipment references
- View recent order history on the dashboard

</details>

<details>
<summary><strong>🧠 AI Demand Forecasting</strong></summary>
<br/>

- Powered by **XGBoost** (with Prophet fallback) via Python FastAPI microservice
- Input historical sales data and receive predictions for:
  - 📅 Next **30 days**
  - 📅 Next **60 days**
  - 📅 Next **90 days**
- Each forecast includes a **confidence score**
- **Smart Reorder Engine** — calculates reorder points and generates purchase recommendations automatically

</details>

<details>
<summary><strong>📊 Analytics & Intelligence</strong></summary>
<br/>

- **ABC Inventory Classification** — auto-classifies every product:
  - 🔴 **Class A** — Top 80% of annual usage value (high priority)
  - 🟡 **Class B** — Next 15% (medium priority)
  - ⚫ **Class C** — Bottom 5% (low priority)
- **Multi-product sales trend chart** — compare top 5 products over 3, 6, or 12 months
- **Category valuation donut chart** — stock value by category
- **Inventory turnover bar chart** — per-category turnover ratio
- 📄 **One-click PDF export** — exports full analytics page as a report

</details>

<details>
<summary><strong>🤖 AI Chatbot Assistant</strong></summary>
<br/>

- Powered by **Google Gemini 2.0 Flash**
- Understands natural language queries with **real warehouse context** (stock levels, alerts, orders)
- **Intent detection** for:
  - Low stock and critical alerts
  - Reorder recommendations
  - Top-selling products
  - Current inventory summary
  - Recent order status
- Renders **inline data tables** for structured responses
- **5 quick-query chips** for instant one-click insights
- Animated typing indicator, message timestamps, clear history

</details>

<details>
<summary><strong>🔔 Real-time Notification System</strong></summary>
<br/>

- WebSocket-driven live alerts — no polling needed
- **Sliding notification drawer** with backdrop overlay
- Per-alert **Mark as Read** and **Resolve** actions
- Bulk **Mark All Read** in one click
- Alert severity levels: `CRITICAL` / `WARNING` / `INFO`
- Auto-triggered on low-stock threshold crossing

</details>

<details>
<summary><strong>👤 User Management (Admin Only)</strong></summary>
<br/>

- Full CRUD: create, edit, deactivate users
- Assign/change roles (Admin, Manager, Staff)
- Search and filter by name, email, or role
- Confirm-to-delete safety guard

</details>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        FRONTEND                          │
│     React 18 + TypeScript + Tailwind CSS + Vite          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐  │
│  │Dashboard │  │Inventory │  │Forecasting│  │Chatbot │  │
│  └──────────┘  └──────────┘  └───────────┘  └────────┘  │
│            WebSocket Client (Socket.IO)                  │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP / WS
┌────────────────────────▼─────────────────────────────────┐
│                   BACKEND (Node.js)                       │
│          Express + TypeScript + Prisma ORM               │
│   ┌───────┐ ┌─────────┐ ┌──────────┐ ┌───────────────┐  │
│   │  Auth │ │Products │ │  Orders  │ │  Analytics    │  │
│   └───────┘ └─────────┘ └──────────┘ └───────────────┘  │
│              JWT Auth • RBAC Middleware                   │
└──────┬─────────────────────────┬────────────────────────┘
       │ Prisma                  │ HTTP
┌──────▼──────┐        ┌─────────▼────────────────────────┐
│ PostgreSQL  │        │       AI MICROSERVICE (Python)    │
│   Database  │        │    FastAPI + XGBoost + Gemini     │
│  (Prisma)   │        │  /forecast  •  /chatbot           │
└─────────────┘        └──────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite, Recharts |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL 15 |
| **AI Service** | Python, FastAPI, XGBoost, Prophet, Google Gemini 2.0 Flash |
| **Auth** | JWT, bcrypt, RBAC middleware |
| **Real-time** | WebSocket (ws library), Socket.IO client |
| **Barcode** | @ericblade/quagga2 (camera-based scanner) |
| **PDF Export** | jsPDF + html2canvas |
| **Container** | Docker + Docker Compose |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **PostgreSQL** 15 (running locally or via Docker)
- A **Google Gemini API Key** (free at [aistudio.google.com](https://aistudio.google.com))

---

### 1. Clone the repository

```bash
git clone https://github.com/AnshGupta-byte/Warehouse-Management-system.git
cd Warehouse-Management-system
```

---

### 2. Set up the Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/warehouse_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this"
PORT=5000
AI_SERVICE_URL="http://localhost:8000"
NODE_ENV=development
```

Run database migrations and seed:
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

Start the backend:
```bash
npm run dev
# → Running on http://localhost:5000
```

---

### 3. Set up the AI Service

```bash
cd ai-service
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `ai-service/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8000
```

Start the AI service:
```bash
python main.py
# → Running on http://localhost:8000
```

---

### 4. Set up the Frontend

```bash
cd frontend
npm install
npm run dev
# → Running on http://localhost:5173
```

---

### 5. Open the app

```
http://localhost:5173
```

**Default seed credentials:**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@warehouse.ai | admin123 |
| Manager | manager@warehouse.ai | manager123 |
| Staff | staff@warehouse.ai | staff123 |

---

### 🐳 Docker (Alternative — all services at once)

```bash
# Copy and fill in your API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key_here

docker compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| AI Service | http://localhost:8000 |

---

## 📁 Project Structure

```
warehouse-ai/
├── frontend/                  # React + TypeScript SPA
│   └── src/
│       ├── components/
│       │   ├── Layout.tsx         # Sidebar + Notification Drawer
│       │   ├── Chatbot.tsx        # AI chat interface
│       │   └── BarcodeScanner.tsx # Camera barcode scanner
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Inventory.tsx
│       │   ├── Orders.tsx
│       │   ├── Forecasting.tsx
│       │   ├── Analytics.tsx      # Heatmap + ABC + Trends + PDF
│       │   └── UserManagement.tsx
│       ├── context/
│       │   ├── AuthContext.tsx
│       │   └── SocketContext.tsx
│       └── services/
│           └── api.ts             # Typed API client
│
├── backend/                   # Node.js + Express API
│   └── src/
│       ├── controllers/
│       │   ├── authController.ts
│       │   ├── productController.ts
│       │   ├── orderController.ts
│       │   ├── warehouseController.ts
│       │   ├── forecastController.ts
│       │   ├── alertController.ts
│       │   ├── analyticsController.ts  # ABC + Trends
│       │   ├── chatbotController.ts    # Intent detection
│       │   └── userController.ts
│       ├── routes/
│       ├── middleware/
│       │   └── authMiddleware.ts   # JWT + RBAC
│       ├── services/
│       │   └── websocketService.ts
│       └── app.ts
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
│
├── ai-service/                # Python FastAPI microservice
│   ├── app/
│   │   ├── chatbot.py         # Gemini 2.0 Flash integration
│   │   ├── forecaster.py      # XGBoost demand forecasting
│   │   └── schemas.py
│   └── main.py
│
└── docker-compose.yml
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login, returns JWT |
| `GET` | `/api/auth/me` | Get current user profile |

### Products & Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/products` | List all products (with stock) |
| `POST` | `/api/products` | Create product + initial stock |
| `POST` | `/api/products/adjust-stock` | Stock in / out / adjustment |
| `GET` | `/api/products/categories` | List all categories |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/orders` | List all orders |
| `POST` | `/api/orders` | Create new order |
| `PATCH` | `/api/orders/:id/status` | Update order status |

### Warehouses
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/warehouses` | List warehouses |
| `GET` | `/api/warehouses/:id/heatmap` | Spatial bin heatmap data |

### Analytics
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/analytics/abc` | ABC classification for all products | Manager+ |
| `GET` | `/api/analytics/trends` | Multi-product sales trend data | Manager+ |
| `GET` | `/api/analytics/turnover` | Category turnover ratios | Manager+ |

### AI Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/forecast` | Demand forecast (30/60/90 day) |
| `POST` | `/api/chatbot` | AI chatbot query with context |

### User Management *(Admin only)*
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | Create user |
| `PATCH` | `/api/users/:id` | Update user / change role |
| `DELETE` | `/api/users/:id` | Delete user |

---

## 🔐 Environment Variables

### Backend (`backend/.env`)
```env
DATABASE_URL=             # PostgreSQL connection string
JWT_SECRET=               # Secret for signing JWTs
PORT=5000
AI_SERVICE_URL=           # URL of Python AI microservice
NODE_ENV=development
```

### AI Service (`ai-service/.env`)
```env
GEMINI_API_KEY=           # Google AI Studio API key
PORT=8000
```

> ⚠️ **Never commit `.env` files.** Add `*.env` to your `.gitignore`.

---

## 🗺️ Feature Walkthrough

### Dashboard
Real-time KPI cards — total products, stock value, low-stock count, recent orders. Live updates via WebSocket.

### Inventory & Barcode Scanner
Full product catalog with spatial slot assignments. Click **Scan** to open the camera-based barcode reader — scan any product label and the search bar auto-fills.

### Demand Forecasting
Select any product, input historical sales, and the AI microservice returns 30/60/90-day demand predictions with a confidence score and reorder recommendations.

### Analytics & Heatmap
- Click any cell on the warehouse floor grid to inspect its contents
- View ABC classification table — sortable, searchable, filterable by class
- Compare top products on a multi-line trend chart
- Click **Export PDF** to download a snapshot of the full analytics report

### AI Chatbot
Click the chat bubble (bottom-right), use quick chips or type a natural-language question:
> *"Which products are running low?"*
> *"What should I reorder this week?"*
> *"Show me the top 5 selling products"*

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'feat: add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ using React, Node.js, PostgreSQL, FastAPI, and Google Gemini

⭐ **Star this repo** if you found it useful!

</div>
