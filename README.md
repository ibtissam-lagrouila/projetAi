# Datalift 🚀

> **Immutable Data Preparation & ML Governance Engine for AI Teams.**
> 
> *Interface Language: English*

Datalift is a modern monorepo (FastAPI + React) architected as *"Git for Data"*. It enables AI teams to ingest tabular, text, and image datasets, automatically convert them into high-performance columnar **Apache Parquet**, track the cryptographic lineage (Merkle DAG) of each transformation, and ensure absolute version immutability via deterministic SHA-256 hashes.

---

## 🌟 Key Capabilities

- **Immutable Data Model**:
  - `Dataset`: Logical container of a dataset.
  - `DatasetVersion`: Physical snapshot in Parquet format identified by a unique SHA-256 hash.
  - `Transformation`: Deterministic specification linking a source version to a target version.
- **Ingestion & Parquet Engine**:
  - Multipart endpoint for CSV upload (`/api/v1/datasets/{id}/upload` and `/api/v1/datasets/upload-raw`).
  - Streaming conversion and compression (`PyArrow` with Snappy).
  - Automatic schema extraction, type detection, and row counting.
  - Deterministic version hash computation:
    $$\text{version\_hash} = \text{SHA256}(\text{parent\_hash} + \text{transformation\_spec} + \text{data\_hash})$$
- **Lineage & Reproducibility**:
  - Full traceability across transformation history (`FILTER_QUERY`, `SELECT_COLUMNS`, `DROP_NULLS`).
- **Automated Tests**:
  - Comprehensive unit and integration test suite with `pytest` covering Parquet conversion, hash immutability, and all REST endpoints.
- **Modern React Frontend**:
  - Interactive dashboard (Vite + TypeScript + Lucide Icons).
  - Drag-and-drop CSV upload modal.
  - Lineage tree and version history DAG visualization.
  - Schema inspector and tabular preview of dataset sample rows.
  - Direct download of `.parquet` artifacts.

---

## 🏗️ Monorepo Structure

```
projetAi/
├── apps/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── datasets.py        # Dataset creation, listing, CSV upload
│   │   │   │   │   ├── versions.py        # Version listing, schema inspection, download
│   │   │   │   │   └── transformations.py # Operation execution and lineage
│   │   │   │   └── api.py
│   │   │   ├── core/
│   │   │   │   ├── config.py              # Pydantic Settings configuration
│   │   │   │   └── database.py            # SQLAlchemy engine (PostgreSQL / SQLite)
│   │   │   ├── models/                    # SQLAlchemy models (Dataset, DatasetVersion, Transformation)
│   │   │   ├── schemas/                   # Pydantic V2 schemas
│   │   │   ├── services/
│   │   │   │   ├── parquet_service.py     # PyArrow CSV -> Parquet conversion, sample reading
│   │   │   │   ├── lineage_service.py     # Cryptographic hash DAG calculation
│   │   │   │   └── storage_service.py     # Local volume storage management
│   │   │   └── main.py                    # FastAPI entrypoint & CORS middleware
│   │   ├── tests/
│   │   │   ├── conftest.py                # In-memory SQLite test fixtures
│   │   │   ├── test_parquet.py            # Parquet conversion and serialization tests
│   │   │   ├── test_lineage.py            # Immutability and hash determinism tests
│   │   │   └── test_api.py                # REST API integration tests
│   │   ├── storage/datasets/              # Physical Parquet storage
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── frontend/
│       ├── src/
│       │   ├── components/
│       │   │   ├── Navbar.tsx
│       │   │   ├── DatasetList.tsx        # Dataset catalog
│       │   │   ├── UploadModal.tsx        # Drag & drop CSV -> Parquet upload
│       │   │   ├── VersionHistory.tsx     # Version DAG visualization
│       │   │   ├── DataPreviewModal.tsx   # Schema inspection & sample rows
│       │   │   └── TransformationModal.tsx# Transformation runner
│       │   ├── services/api.ts            # Axios HTTP client
│       │   ├── types/index.ts             # TypeScript definitions
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── vite.config.ts
│       └── Dockerfile
│
├── docker-compose.yml                     # PostgreSQL 16 + FastAPI Backend + React Frontend
└── README.md
```

---

## 🚀 Quick Start

### Option 1: Local Run without Docker (Recommended on Windows)

The backend is configured with **Zero-Config SQLite by default**: no need to install PostgreSQL or Docker to test full functionality and immutability!

#### 1-Click Launch:
Double-click:
- **[`start-all.bat`](file:///c:/Users/pc/Documents/projetAi/start-all.bat)**: Automatically starts the FastAPI Backend and React Frontend in two separate terminal windows.

---

#### Or Manually via Terminal:

**1. Start Backend (FastAPI)**:
```powershell
cd apps\backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Healthcheck**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

*(Optional) Seed sample data:*
```powershell
python scripts\seed_demo.py
```

**2. Run Backend Tests**:
```powershell
cd apps\backend
python -m pytest -v
```
*(or double-click [`run-tests.bat`](file:///c:/Users/pc/Documents/projetAi/run-tests.bat))*

**3. Start Frontend (React + Vite)**:
```powershell
cd apps\frontend
npm install
npm run dev
```
- **React Web Interface**: [http://localhost:5173](http://localhost:5173)

---

### Option 2: Docker Compose

```bash
docker compose up --build
```
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **FastAPI API**: [http://localhost:8000](http://localhost:8000)
- **PostgreSQL 16**: Port `5432`

---

## 📡 REST API Specification

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Backend healthcheck |
| `POST` | `/api/v1/datasets/` | Create a dataset container |
| `GET` | `/api/v1/datasets/` | List all datasets with latest version |
| `GET` | `/api/v1/datasets/{id}` | Dataset detail and full version history |
| `DELETE` | `/api/v1/datasets/{id}` | Delete a dataset and its versions |
| `POST` | `/api/v1/datasets/{id}/upload` | **Upload CSV, convert to Parquet, and create immutable version** |
| `POST` | `/api/v1/datasets/upload-raw` | Create dataset and upload initial CSV in one request |
| `GET` | `/api/v1/versions/dataset/{id}` | Dataset version history |
| `GET` | `/api/v1/versions/hash/{hash}` | Version detail, schema, and sample rows |
| `GET` | `/api/v1/versions/download/{hash}` | Download physical `.parquet` artifact |
| `POST` | `/api/v1/transformations/apply/{source_id}` | Apply transformation and derive new version |
| `GET` | `/api/v1/versions/{version_hash}/profile` | Comprehensive statistical profile of a version |
| `PUT` | `/api/v1/versions/{version_hash}/target` | Set and persist target column for a version |
| `POST` | `/api/v1/cleaning/{version_hash}/preview` | Simulate cleaning operations batch (diffs, warnings) |
| `POST` | `/api/v1/cleaning/{version_hash}/apply` | Execute cleaning operations, save immutable version |
| `GET` | `/api/v1/cleaning/{version_hash}/categories` | List unique categories of a column with counts |

---

## 📊 Module 01: Profiling & AI Health Score

The profiling module deeply analyzes structural, statistical, and quality characteristics of each dataset version without simulated mock data.

### 1. Mathematical Formulas for the 5 Sub-Scores (out of 100)

1. **Completeness ($S_{\text{completeness}}$, Weight: 25%)**:
   $$S_{\text{completeness}} = 100 \times \left(1 - \frac{\sum_{j=1}^M \text{nulls}_j}{N \times M}\right)$$

2. **Uniqueness ($S_{\text{uniqueness}}$, Weight: 20%)**:
   $$S_{\text{uniqueness}} = 100 \times \left(1 - \frac{\text{duplicate\_rows\_count}}{N}\right)$$

3. **Validity ($S_{\text{validity}}$, Weight: 20%)**:
   $$S_{\text{validity}} = 100 \times \left(1 - \frac{\text{columns\_with\_anomalies}}{M}\right)$$

4. **Consistency ($S_{\text{consistency}}$, Weight: 20%)**:
   $$S_{\text{consistency}} = 100 \times \left(1 - \frac{\text{inconsistent\_categorical\_columns}}{\text{categorical\_columns}}\right)$$

5. **Class Balance ($S_{\text{balance}}$, Weight: 15%)**:
   Normalized Shannon entropy over discrete target ($K \ge 2$ classes):
   $$S_{\text{balance}} = 100 \times \frac{-\sum_{k=1}^K p_k \log(p_k)}{\log(K)}$$

### 2. Overall Health Score (out of 100)

$$\text{Health Score} = \text{round}\left(\frac{\sum_{i \in \text{active}} w_i \times S_i}{\sum_{i \in \text{active}} w_i}\right)$$

---

## 🧹 Module 02: Deterministic Cleaning & Immutability

1. **Text Normalization (`TEXT_NORMALIZE`)**: lowercase, trim whitespace, and diacritics removal.
2. **Category Merging (`CATEGORY_MERGE`)**: alias mapping to canonical target.
3. **Missing Value Handling (`HANDLE_MISSING`)**: drop rows, statistical imputation (mean, median), or categorical imputation (mode, constant).
4. **Outlier Handling (`HANDLE_OUTLIERS`)**: Tukey IQR fencing $[Q_1 - 1.5\text{IQR}, Q_3 + 1.5\text{IQR}]$ with clipping or dropping.
5. **Deduplication (`DROP_DUPLICATES`)**: strict duplicate row removal.

---

## 🔬 Module 03: Augmentation & Stratified Balancing

- **Split First Principle**: Only the **Train** split is augmented or resampled. Validation and Test splits remain **100% real and locked**.
- **Deterministic SMOTE-NC**: Nearest neighbors calculated strictly on Train minority instances. Parent traceability logged via `parent_ids`.
- **50% Cap**: Synthetic rows cannot exceed existing real instances of that class ($N_{\text{synth}} \le N_{\text{min\_real}}$).
- **6 Integrity Guardrails**: Verified before persistence.

---

## 📦 Module 04: Versioning & Lineage

- **Merkle DAG Lineage Graph**: Every dataset version is cryptographically linked to its parent.
- **Zero-Copy Virtual Views**: Filter by split, origin, or synthetic status on the fly without duplicating disk storage.
- **Full Difference Engine**: Deep row-level and column-level diffs with Kolmogorov-Smirnov and Total Variation Distance shift scores.
- **Deletion Protection**: Guardrails reject deleting versions with active children, production tags, or baseline designations.
- **Exportable Dataset Card**: Automated Markdown and JSON dataset documentation cards.

---

## 🔒 Immutability & Reproducibility

Every version is cryptographically sealed by its SHA-256 logical content hash. Transformations executed with identical inputs and parameters produce identical hashes, ensuring absolute reproducibility across all data pipelines and machine learning experiments.
