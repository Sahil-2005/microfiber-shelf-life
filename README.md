# 🌊 Microfiber Release Prediction & Shelf-Life Estimation

An **Advanced Machine Learning** project that utilizes deep learning sequence modeling to predict the degradation of textiles over time, estimating the shelf-life of garments based on their physical properties and wash conditions.

## 📖 The Problem

Every time we wash our clothes, mechanical agitation, temperature, and chemicals cause fabrics to break down. This results in the release of **microfibers**—a leading source of microplastic pollution in our oceans. For consumers and brands, this degradation drastically reduces the "shelf life" and structural quality of the garment.

## 🚀 The Solution

Instead of treating microfiber release as an independent event, this project models fabric degradation as a **cumulative, sequential process (time-series)**. 

We built an end-to-end Machine Learning pipeline that takes the physical properties of the cloth (yarn count, weight, weave) and the wash conditions (temperature, detergent, agitation) to mathematically forecast the trajectory of microfiber release across 50 wash cycles using a **Long Short-Term Memory (LSTM) Neural Network**.

When the release trajectory crosses a specific degradation threshold, the system calculates the "end of shelf life" for that specific garment.

## 🧠 Technical Architecture

This project was built from the ground up to demonstrate advanced machine learning techniques:

### 1. Physics-Inspired Sequence Data Generation
*   Generated a highly realistic time-series dataset of 75,000 records (1,500 unique fabrics tracked across 50 continuous washes).
*   The simulation mathematics account for two opposing physical forces: 
    1. An initial **exponential decay** (loose fibers washing out early).
    2. A **linear accumulation of structural wear** (the fabric breaking down over time, releasing more fibers later in its life).

### 2. Deep Learning Modeling (PyTorch LSTM)
*   **Why LSTM?** Fabric degradation is a time-series problem. A standard regression model treats 'Wash 25' independently. An LSTM carries a hidden state forward through time, which perfectly mimics the physical accumulation of structural damage inside the fabric.
*   **Preprocessing:** Utilized `Scikit-Learn` for strict numerical scaling (`StandardScaler`) and categorical encoding (`OneHotEncoder`). Both input features and the target variables were scaled to ensure smooth gradient propagation and optimal learning.

### 3. Explainable AI (SHAP)
*   Neural networks are notoriously "black boxes." To provide absolute transparency, we integrated **SHAP (SHapley Additive exPlanations)** via `shap.DeepExplainer`.
*   SHAP calculates the exact marginal contribution of every single feature (e.g., Yarn Count, Weave Type) to the final degradation curve, proving to the user exactly *why* a specific fabric degraded the way it did based on its physical and chemical profile.

### 4. Full-Stack Deployment
*   **Backend:** A highly asynchronous **FastAPI (Python)** server that loads the trained PyTorch model weights and handles real-time sequence tensor generation for deep learning inference.
*   **Frontend:** A dynamic **React (Vite)** dashboard that queries the API, plots the predicted lifecycle curve over time, and displays the SHAP explainability charts.

## 📂 Repository Structure

```text
microfiber-shelf-life/
│
├── backend/                  # FastAPI backend server
│   └── main.py               # API endpoints & LSTM inference logic
│
├── frontend/                 # React (Vite) frontend application
│   ├── src/App.jsx           # Main UI dashboard and API integration
│   └── public/               # Static assets including the SHAP summary plot
│
├── src/                      # Core Machine Learning Scripts
│   ├── generate_sequence_data.py  # Time-series simulation engine
│   ├── train_lstm.py         # PyTorch LSTM training pipeline
│   └── explain_shap.py       # SHAP Explainable AI generation script
│
├── models/                   # Saved model states and scalers (.pth, .pkl)
├── data/                     # Generated CSV datasets
└── requirements_clean.txt    # Python dependencies
```

## 🛠️ How to Run Locally

### Prerequisites
- Node.js (v18+)
- Python (3.10+)

### 1. Setup the Python Environment
```bash
# Create and activate a virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements_clean.txt torch shap fastapi uvicorn
```

### 2. Start the FastAPI Backend
```bash
# From the root of the project
python -m uvicorn backend.main:app --reload
# The API will run on http://127.0.0.1:8000
```

### 3. Start the React Frontend
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
# The UI will run on http://localhost:5173
```

---

## 👤 Author

**Sahil Gawade**
<br>
<a href="https://github.com/Sahil-2005" target="_blank"><img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub"/></a>
<a href="https://www.linkedin.com/in/sahil-gawade-920a0a242/" target="_blank"><img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"/></a>
<a href="mailto:gawadesahil.dev@gmail.com" target="_blank"><img src="https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white" alt="Gmail"/></a>
<a href="https://leetcode.com/u/sahilgawade4321/" target="_blank"><img src="https://img.shields.io/badge/LeetCode-FFA116?style=for-the-badge&logo=LeetCode&logoColor=black" alt="LeetCode"/></a>
<a href="https://sahil-gawade.vercel.app/" target="_blank"><img src="https://img.shields.io/badge/Portfolio-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Portfolio"/></a>

