# WarehouseAI - AI-Powered Warehouse Management System

An enterprise-grade, multi-service Warehouse Management System (WMS) built using React, Express, Python FastAPI, and PostgreSQL. It incorporates seasonal demand forecasting models, smart safety-stock calculators, interactive warehouse heatmap grids, live WebSocket notifications, and retrieval-augmented (RAG) conversational query chatbots.

## Features Checklist
- **Authentication**: JWT authentication with Role-Based Access Control (Admin, Manager, Staff).
- **Inventory Control**: Automatic SKU generation, multi-warehouse stock level, location placements (aisle, shelf, bin).
- **Order Pipelines**: Inbound POs and Outbound SOs. Stock levels balance dynamically when orders are marked as fulfilled (`DELIVERED`).
- **Aesthetic Heatmap**: Interactive slot density grids showing space occupancy.
- **AI Demand Forecasting**: Seasonal Linear Regression pipeline delivering 30, 60, and 90-day predictions.
- **Smart PO Reorder Engine**: Safety stock and ROP estimation matrixes that generate replenishment recommendations.
- **AI Chatbot**: Real-time context RAG conversational querying powered by Gemini.
- **WebSocket Broadcasts**: Live updates on alerts, stocks, and order changes.
- **Dockerization**: Ready-to-go `docker-compose.yml` for database, backends, and frontends.

## Folder Layout
- `frontend/`: Vite + React + TypeScript + Tailwind CSS application.
- `backend/`: Node.js + Express + TypeScript + Prisma API server.
- `ai-service/`: Python FastAPI microservice containing forecasting pipelines and Gemini chatbot bindings.

## How to Get Started
To deploy or run the stack, please refer to the detailed [Deployment & Setup Guide](file:///C:/Users/anshg/.gemini/antigravity/scratch/warehouse-ai/deployment-guide.md).
