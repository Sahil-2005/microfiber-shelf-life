# 🛒 Microfiber Score — Chrome Extension (Manifest V3)

A Chrome browser extension powered by a physics-grounded **PyTorch 2-layer LSTM** neural network that predicts garment microfiber shedding and displays an **A–E Sustainability Grade** badge directly next to product prices on e-commerce sites (Amazon, Myntra, and custom storefronts).

---

## 🌟 Key Features

1. **In-Page Badge Injection**: Injects an isolated **Shadow DOM** rating badge (`Grade A–E`, cumulative grams, and confidence pill) next to the price on shopping product pages without stylesheet collision.
2. **Interactive 50-Wash Lifecycle Curve**: Clicking the badge slides open a side panel featuring a pure SVG line chart tracking microfiber shedding from wash 1 to 50 with a stabilization wash marker.
3. **Wash Habit Simulator**: Real-time sliders for **Wash Temperature (20°C–60°C)**, **Mechanical Agitation (0.5x–1.5x)**, and **Detergent Formulation (Standard, Bio-Enzyme, Eco)** with debounced live score recalculation.
4. **Greener Swaps & Mitigation**: Actionable suggestions including fiber alternatives, cold wash savings, and washing bag efficiency.
5. **Search Results Mode**: Batch-badges listing cards on search/category pages with mini grade indicators.
6. **Basket Microfiber Impact**: Computes aggregate cumulative microfiber shed on checkout and shopping cart pages.

---

## 🏗️ Architecture

```
extension/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # MV3 Service Worker (API proxy & chrome.storage)
├── content.js                 # Shadow DOM badge injection, SVG chart & panel
├── extractors.js              # Regex parsers for composition, GSM, weave, yarn count
├── generate_icons.js          # Generator for extension icons
├── icons/                     # 16x16, 48x48, 128x128 extension icons
├── popup/
│   ├── popup.html             # Toolbar popup UI
│   ├── popup.css              # Modern teal aesthetic stylesheet
│   └── popup.js               # Settings & API health connectivity logic
├── adapters/
│   ├── base.js                # Self-registering site adapter pattern
│   ├── amazon.js              # Amazon.in / Amazon.com DOM extractor
│   ├── myntra.js              # Myntra.com DOM extractor
│   └── demo-shop.js           # Clean data-mf-* attribute adapter for demo store
└── tests/
    ├── test_extractors.js     # Node.js regex unit tests (7 test cases)
    └── test_backend_api.py    # Python integration tests for FastAPI endpoints
```

---

## 🚀 Quickstart & Setup

### 1. Start the Backend API

Make sure dependencies are installed and run the FastAPI server:

```powershell
# From the repository root
venv\Scripts\activate
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The server exposes:
- `GET /` — Health check
- `POST /score` — Comprehensive grading, blend inference, uncertainty, reasons, and swaps
- `POST /extract` — Server-side text composition parser
- `POST /predict` — Single wash point prediction
- `POST /shelf-life` — 50-step sequence analysis

### 2. Load the Extension in Google Chrome

1. Open Google Chrome (or Microsoft Edge / Brave).
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `extension/` directory inside this repository.
6. The **Microfiber Score** icon will appear in your toolbar!

---

## 🧪 Testing with the Local Demo Store

A test store with 6 diverse textile compositions is provided in `/demo-shop`:

1. Serve the demo shop locally:
   ```powershell
   python -m http.server 3000
   ```
2. Navigate to `http://localhost:3000/demo-shop/index.html` in Chrome.
3. Observe:
   - **Mini Badges** on each product card in the catalog grid.
   - Click any garment to view its **Product Detail Page (PDP)**.
   - The **Microfiber Score Badge** appears next to the price.
   - Click the badge to open the **50-Wash Lifecycle Curve** and adjust wash temperature or agitation sliders.
   - Click the **Cart** button in the header to view the **Basket Microfiber Impact** banner!

### Products Included for Evaluation

| Product | Fiber Composition | GSM | Expected Grade |
|---|---|---|---|
| **Pure Earth Everyday Tee** | 100% Organic Cotton | 140 | **Grade A** (Low shed, biodegradable) |
| **AeroTech Shell Jacket** | 100% Ripstop Nylon | 160 | **Grade B** (Moderate shed) |
| **Urban Comfort Hoodie** | 60% Cotton / 40% Poly | 240 | **Grade C** (Blended microplastics) |
| **ArcticSummit Fleece** | 100% Recycled Polyester | 320 | **Grade E** (High loose microplastic shed) |
| **Nordic Cable Sweater** | 100% Acrylic Soft-Spun | 280 | **Grade D/E** (Staple fiber breakage) |
| **Artisan Summer Shirt** | 100% Organic Linen | 160 | **Grade A** (Natural cellulosic flax) |

---

## 🧪 Running Automated Tests

### Extractor Unit Tests (JavaScript / Node.js)
```bash
node extension/tests/test_extractors.js
```
*Validates pure cotton, polyester fleece, 60/40 blends, nylon weaves, GSM extraction, and yarn count.*

### Backend API Integration Tests (Python)
```bash
venv\Scripts\python.exe extension/tests/test_backend_api.py
```
*Validates `/extract`, `/score`, fallback defaults, `/predict`, and `/shelf-life`.*

---

## 🔬 Grading Scale & Model Reference

| Grade | 50-Wash Shedding | Rating | Ecological Significance |
|---|---|---|---|
| **A** | `< 8.0g` | **Excellent** | Predominantly natural or tightly spun filaments; minimal environmental persistence. |
| **B** | `8.0g – 14.0g` | **Good** | Low-to-moderate shedding under standard cycle conditions. |
| **C** | `14.0g – 22.0g` | **Fair** | Blended materials; moderate synthetic fiber release. |
| **D** | `22.0g – 35.0g` | **Poor** | High shedding rate; warm cycles significantly accelerate wear. |
| **E** | `> 35.0g` | **Very Poor** | Heavy fleece/sherpa/acrylic; high volume of non-biodegradable microplastics. |
