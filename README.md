# SenstoSales ERP: The High-Precision Document Lifecycle Engine

![SenstoSales Hero](docs/images/hero_mockup.png)

**SenstoSales** is a sophisticated, enterprise-grade ERP system designed for suppliers managing complex B2B document lifecycles. It transforms the chaotic flow of Purchase Orders, Delivery Challans, and Store Receipt Vouchers into a streamlined, automated, and visually stunning experience.

---

## 🌟 Product Capabilities

### 🔍 Nexus: Actionable Global Search
Nexus isn't just a search bar; it's a Command Center. Using a **Command-K** style interface, it provides:
- **Semantic Lookup**: Find any document (PO, DC, Invoice, SRV) instantly by number, party name, or material code.
- **Actionable Commands**: Type `create dc for PO-123` to instantly navigate to the creation page with pre-filled data.
- **Pulse Indicators**: Real-time status badges in search results showing exactly where a document is in its lifecycle.

### ⚖️ Data Reconciliation Engine
The system features a robust parity engine that automatically aligns supplier-side records with buyer-side confirmations (SRV).
- **Automated Matching**: Links messy buyer SRV HTML/Excel data to internal Purchase Orders using fuzzy material code matching.
- **Deviation Detection**: Highlights discrepancies in quantity, value, or tax calculations between what was sent and what was received.
- **Parity Dashboards**: Specialized views for "Shortages" and "Pending Reconciliations" to ensure no revenue leakages occur.

### ⚡ Async Post-Ingestion Pipelines
SenstoSales handles messy, unstructured data from external portals with ease through its advanced data pipelines:
- **Robust Parsers**: Ingests data from complex HTML table structures and legacy Excel formats (XLS/XLSX).
- **Graceful Error Recovery**: Handles "Footer Leakage," inconsistent date formats, and partial data ingestion without stopping the pipeline.
- **Background Normalization**: Automatically converts various units and formats into a standardized internal schema.

### 🎨 macOS Tahoe UI & Atomic Design
The interface is a love letter to modern macOS aesthetics, built with technical rigor:
- **Glassmorphic Design**: A premium interface using HSL-tailored color palettes, subtle blurs, and micro-animations.
- **Atomic Architecture**: 50+ modular components (Atoms, Molecules, Organisms) built for scalability and consistency.
- **Tahoe Design System**: A unified design language featuring premium typography (Inter/Outfit) and semantic tokens.

---

## 🛠️ Technical Showcase

### Core Architecture
- **Frontend**: [Next.js 16 (App Router)](https://nextjs.org/) with [Zustand](https://github.com/pmndrs/zustand) for state synchronization across complex document forms.
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) powered by a high-performance SQLite engine with custom DB triggers for transactional safety.
- **Reporting**: Advanced document generation using `openpyxl` and `xlsxwriter`, delivering compliant, pixel-perfect Excel reports.

### Scalable Invariants
The system enforces strict business rules at the database level:
- **DC-2 Invariant**: Ensures a 1:1 relationship between Delivery Challans and Invoices.
- **Atomic Inventory**: Prevents over-dispatch by reconciling quantities across multiple partial shipments.

---

## 📂 Project Structure

```text
SenstoSales/
├── frontend/           # Next.js 16 Web Application (Tahoe UI)
│   ├── components/     # Atomic Design Components
│   ├── store/          # Zustand State Management
│   └── app/            # App Router & Layouts
├── backend/            # FastAPI REST API (Business Logic)
│   ├── api/            # Action-oriented routers
│   ├── core/           # Config, Security & Parsers
│   └── services/       # Reconciliation & Ingestion Pipelines
├── migrations/         # PostgreSQL-compatible SQL Schema
└── docs/               # High-fidelity documentation & mockups
```

---

## ⚙️ Quick Start

1. **Install Dependencies**:
   ```bash
   # Frontend
   cd frontend && npm install
   
   # Backend
   cd ../backend && pip install -r requirements.txt
   ```

2. **Launch Terminal**:
   ```bash
   # Run development environment
   ./dev_start.ps1
   ```

---

## 📜 License & Acknowledgments

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

*Note: This repository is a sanitized technical showcase version of the production application, focusing on architectural patterns and product-level capabilities.*
