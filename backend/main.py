from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import joblib
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

app = FastAPI(
    title="Microfiber Prediction API (Advanced LSTM)"
)

# --- Define LSTM Architecture (Matches training) ---
class MicrofiberLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2):
        super(MicrofiberLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size=input_size, hidden_size=hidden_size, num_layers=num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out)
        return out

# --- Load Models ---
BASE_DIR = Path(__file__).resolve().parents[1]
PREPROCESSOR_PATH = BASE_DIR / "models" / "preprocessor.pkl"
WASH_SCALER_PATH = BASE_DIR / "models" / "wash_scaler.pkl"
TARGET_SCALER_PATH = BASE_DIR / "models" / "target_scaler.pkl"
MODEL_PATH = BASE_DIR / "models" / "lstm_model.pth"

preprocessor = joblib.load(PREPROCESSOR_PATH)
wash_scaler = joblib.load(WASH_SCALER_PATH)
target_scaler = joblib.load(TARGET_SCALER_PATH)

# Get input size dynamically from a dummy transform or hardcode if known.
# Cat: 5 (fabric) + 3 (weave) + 3 (detergent) = 11. Num = 4. Wash = 1. Total = 16.
device = torch.device("cpu")
model = MicrofiberLSTM(input_size=16).to(device)
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.eval()

class FabricInput(BaseModel):
    Fabric_Type: str
    Fabric_Weight_gsm: float
    Yarn_Count: float
    Weave_Type: str
    Wash_Temperature_C: float
    Detergent_Type: str
    Mechanical_Agitation: float
    Number_of_Washes: int

def prepare_sequence_tensor(data: FabricInput, max_washes: int):
    # Prepare static features
    input_data = pd.DataFrame([{
        "Fabric_ID": 99999, # Dummy
        "Fabric_Type": data.Fabric_Type,
        "Fabric_Weight_gsm": data.Fabric_Weight_gsm,
        "Yarn_Count": data.Yarn_Count,
        "Weave_Type": data.Weave_Type,
        "Wash_Temperature_C": data.Wash_Temperature_C,
        "Detergent_Type": data.Detergent_Type,
        "Mechanical_Agitation": data.Mechanical_Agitation,
        "Wash_Number": 1 # Dummy for fit
    }])
    
    X_static = preprocessor.transform(input_data)
    
    # Prepare sequence of wash numbers
    wash_seq = np.arange(1, max_washes + 1).reshape(-1, 1)
    wash_seq_scaled = wash_scaler.transform(wash_seq)
    
    # Repeat static features for all time steps
    X_static_seq = np.repeat(X_static, max_washes, axis=0)
    
    # Combine
    X_full = np.hstack((X_static_seq, wash_seq_scaled))
    
    # Shape for LSTM: (batch=1, seq=max_washes, features=16)
    X_tensor = torch.tensor(X_full, dtype=torch.float32).unsqueeze(0).to(device)
    return X_tensor

@app.get("/")
def home():
    return {"message": "Advanced Microfiber LSTM Prediction API is running"}

@app.post("/predict")
def predict(data: FabricInput):
    target_wash = data.Number_of_Washes
    if target_wash < 1:
        target_wash = 1
        
    X_tensor = prepare_sequence_tensor(data, max_washes=target_wash)
    
    with torch.no_grad():
        outputs = model(X_tensor)
        
    # Get the prediction for the final step in the sequence
    scaled_pred = outputs[0, -1, 0].item()
    
    # Inverse transform
    final_pred = target_scaler.inverse_transform([[scaled_pred]])[0][0]
    
    return {
        "predicted_microfiber_release_mg": round(float(final_pred), 2)
    }

@app.post("/shelf-life")
def calculate_shelf_life(data: FabricInput):
    max_washes = 50
    X_tensor = prepare_sequence_tensor(data, max_washes=max_washes)
    
    with torch.no_grad():
        outputs = model(X_tensor)
        
    # predictions shape: (1, 50, 1)
    scaled_predictions = outputs[0, :, :].numpy() # shape (50, 1)
    
    # Inverse transform all
    raw_predictions = target_scaler.inverse_transform(scaled_predictions).flatten().tolist()
    predictions = [round(p, 2) for p in raw_predictions]
    
    wash_values = list(range(1, max_washes + 1))
    threshold = 20
    shelf_life = None
    
    for wash, prediction in zip(wash_values, predictions):
        if prediction <= threshold:
            shelf_life = wash
            break
            
    return {
        "wash_values": wash_values,
        "predictions": predictions,
        "threshold": threshold,
        "estimated_shelf_life": shelf_life
    }

# --- EXTENSION SUPPORT: Advanced Extraction & Microfiber Scoring ---

VALID_FABRICS = ['Acrylic', 'Cotton', 'Cotton-Poly Blend', 'Nylon', 'Polyester']
VALID_WEAVES = ['Plain', 'Satin', 'Twill']
VALID_DETERGENTS = ['Eco', 'Enzyme', 'Standard']

FABRIC_SYNONYMS = {
    'polyester': 'Polyester',
    'cotton': 'Cotton',
    'poly-cotton': 'Cotton-Poly Blend',
    'polycotton': 'Cotton-Poly Blend',
    'cotton-poly': 'Cotton-Poly Blend',
    'cotton-polyester': 'Cotton-Poly Blend',
    'cotton polyester': 'Cotton-Poly Blend',
    'nylon': 'Nylon',
    'polyamide': 'Nylon',
    'acrylic': 'Acrylic',
    'fleece': 'Polyester',
    'microfiber': 'Polyester',
    'spandex': 'Nylon',
    'elastane': 'Nylon',
    'lycra': 'Nylon',
    'rayon': 'Cotton',
    'viscose': 'Cotton',
    'modal': 'Cotton',
    'tencel': 'Cotton',
    'denim': 'Cotton',
    'linen': 'Cotton',
    'hemp': 'Cotton',
    'silk': 'Nylon',
    'wool': 'Acrylic'
}

def normalize_fabric(raw: str) -> str:
    if not raw:
        return 'Cotton-Poly Blend'
    r = raw.lower().strip()
    for key in sorted(FABRIC_SYNONYMS.keys(), key=len, reverse=True):
        if key in r:
            return FABRIC_SYNONYMS[key]
    return 'Cotton-Poly Blend'

def normalize_weave(raw: str) -> str:
    if not raw:
        return 'Plain'
    r = raw.lower().strip()
    if 'twill' in r or 'denim' in r or 'jacquard' in r:
        return 'Twill'
    if 'satin' in r or 'silk' in r:
        return 'Satin'
    return 'Plain'

def normalize_detergent(raw: str) -> str:
    if not raw:
        return 'Standard'
    r = raw.lower().strip()
    if 'eco' in r or 'green' in r or 'plant' in r:
        return 'Eco'
    if 'enzyme' in r or 'bio' in r:
        return 'Enzyme'
    return 'Standard'

from typing import Optional, Dict, Any, List

class ExtractRequest(BaseModel):
    text: Optional[str] = ""

@app.post("/extract")
def extract_fabric_properties(req: ExtractRequest):
    import re
    text = req.text.lower() if req.text else ""
    
    # Extract fabric blend percentages e.g. "60% cotton 40% polyester"
    pct_matches = re.findall(r'(\d{1,3})\s*%\s*([a-zA-Z\s-]+)', text)
    blend = {}
    if pct_matches:
        for pct_str, fab_str in pct_matches:
            pct = float(pct_str)
            # Find matching known fabric
            fab_clean = fab_str.strip()
            norm = None
            for key, val in FABRIC_SYNONYMS.items():
                if key in fab_clean:
                    norm = val
                    break
            if norm and 0 < pct <= 100:
                blend[norm] = blend.get(norm, 0.0) + (pct / 100.0)
    
    # GSM extraction
    gsm_match = re.search(r'(\d{2,4})\s*gsm', text)
    gsm = float(gsm_match.group(1)) if gsm_match else None
    
    # Weave extraction
    weave = None
    if any(k in text for k in ['twill', 'denim', 'jacquard']):
        weave = 'Twill'
    elif any(k in text for k in ['satin']):
        weave = 'Satin'
    elif any(k in text for k in ['plain', 'woven', 'knit', 'jersey']):
        weave = 'Plain'
        
    # Yarn count extraction
    yarn_match = re.search(r'(\d{1,3})\s*(?:s\b|ne\b|count)', text)
    yarn_count = float(yarn_match.group(1)) if yarn_match else None
    
    primary_fabric = None
    if blend:
        primary_fabric = max(blend.items(), key=lambda x: x[1])[0]
    else:
        for k, v in FABRIC_SYNONYMS.items():
            if k in text:
                primary_fabric = v
                break

    fields_found = sum(1 for x in [primary_fabric, gsm, weave, yarn_count] if x is not None)
    confidence = "high" if fields_found >= 3 else ("medium" if fields_found >= 1 else "low")

    return {
        "fabric_type": primary_fabric,
        "blend": blend if blend else None,
        "gsm": gsm,
        "weave": weave,
        "yarn_count": yarn_count,
        "confidence": confidence
    }

class ScoreRequest(BaseModel):
    Fabric_Type: Optional[str] = None
    fabric_type: Optional[str] = None
    Blend: Optional[Dict[str, float]] = None
    blend: Optional[Dict[str, float]] = None
    Fabric_Weight_gsm: Optional[float] = None
    fabric_weight_gsm: Optional[float] = None
    Yarn_Count: Optional[float] = None
    yarn_count: Optional[float] = None
    Weave_Type: Optional[str] = None
    weave_type: Optional[str] = None
    Wash_Temperature_C: Optional[float] = None
    wash_temperature_c: Optional[float] = None
    Detergent_Type: Optional[str] = None
    detergent_type: Optional[str] = None
    Mechanical_Agitation: Optional[float] = None
    mechanical_agitation: Optional[float] = None
    Number_of_Washes: Optional[int] = 50
    number_of_washes: Optional[int] = 50
    Product_Title: Optional[str] = None
    product_title: Optional[str] = None
    Product_Price: Optional[str] = None
    product_price: Optional[str] = None
    Raw_Text: Optional[str] = None
    raw_text: Optional[str] = None

GRADE_CONFIG = {
    'A': {'label': 'Excellent', 'color': '#16a34a', 'ring': '#bbf7d0', 'max_g': 8.0},
    'B': {'label': 'Good',      'color': '#65a30d', 'ring': '#d9f99d', 'max_g': 14.0},
    'C': {'label': 'Fair',      'color': '#ca8a04', 'ring': '#fef08a', 'max_g': 22.0},
    'D': {'label': 'Poor',      'color': '#ea580c', 'ring': '#fed7aa', 'max_g': 35.0},
    'E': {'label': 'Very Poor', 'color': '#dc2626', 'ring': '#fecaca', 'max_g': 999.0}
}

@app.post("/score")
def calculate_microfiber_score(req: ScoreRequest):
    # Consolidate alias fields
    raw_fab = req.Fabric_Type or req.fabric_type
    blend_dict = req.Blend or req.blend
    gsm = req.Fabric_Weight_gsm or req.fabric_weight_gsm
    yarn_cnt = req.Yarn_Count or req.yarn_count
    weave = req.Weave_Type or req.weave_type
    temp = req.Wash_Temperature_C or req.wash_temperature_c
    det = req.Detergent_Type or req.detergent_type
    agit = req.Mechanical_Agitation or req.mechanical_agitation
    max_washes = req.Number_of_Washes or req.number_of_washes or 50
    max_washes = max(1, min(100, int(max_washes)))

    defaults_used = []

    # Check for text fallback if fabric not provided
    text_corpus = " ".join([req.Raw_Text or req.raw_text or "", req.Product_Title or req.product_title or ""]).strip()
    if not raw_fab and not blend_dict and text_corpus:
        extracted = extract_fabric_properties(ExtractRequest(text=text_corpus))
        raw_fab = extracted.get("fabric_type")
        blend_dict = extracted.get("blend")
        if not gsm and extracted.get("gsm"):
            gsm = extracted["gsm"]
        if not weave and extracted.get("weave"):
            weave = extracted["weave"]
        if not yarn_cnt and extracted.get("yarn_count"):
            yarn_cnt = extracted["yarn_count"]

    # Fill defaults
    if not raw_fab and not blend_dict:
        raw_fab = "Cotton-Poly Blend"
        defaults_used.append("fabric_type (defaulted to Cotton-Poly Blend)")
    if gsm is None:
        gsm = 180.0
        defaults_used.append("fabric_weight_gsm (defaulted to 180)")
    if yarn_cnt is None:
        yarn_cnt = 30.0
        defaults_used.append("yarn_count (defaulted to 30)")
    if not weave:
        weave = "Plain"
        defaults_used.append("weave_type (defaulted to Plain)")
    if temp is None:
        temp = 40.0
        defaults_used.append("wash_temperature_c (defaulted to 40°C)")
    if not det:
        det = "Standard"
        defaults_used.append("detergent_type (defaulted to Standard)")
    if agit is None:
        agit = 1.0
        defaults_used.append("mechanical_agitation (defaulted to 1.0)")

    norm_weave = normalize_weave(weave)
    norm_det = normalize_detergent(det)

    # Determine blend weights
    weights = {}
    if blend_dict and isinstance(blend_dict, dict) and len(blend_dict) > 0:
        total_pct = sum(blend_dict.values())
        if total_pct > 0:
            for f, val in blend_dict.items():
                norm_f = normalize_fabric(f)
                weights[norm_f] = weights.get(norm_f, 0.0) + (val / total_pct)
    if not weights:
        norm_f = normalize_fabric(raw_fab)
        weights[norm_f] = 1.0

    # Confidence assessment: count detected/provided features vs defaulted ones
    fields_detected = 0
    if not any("fabric_type" in d for d in defaults_used):
        fields_detected += 1
    if not any("fabric_weight_gsm" in d for d in defaults_used):
        fields_detected += 1
    if not any("weave_type" in d for d in defaults_used):
        fields_detected += 1
    if not any("yarn_count" in d for d in defaults_used):
        fields_detected += 1

    if fields_detected >= 3:
        confidence = "high"
        uncertainty_pct = 0.09
    elif fields_detected >= 1:
        confidence = "medium"
        uncertainty_pct = 0.18
    else:
        confidence = "low"
        uncertainty_pct = 0.28

    # Sequence predictions computation via blend-weighted model inference
    combined_curve = np.zeros(max_washes, dtype=np.float32)
    for fab, weight in weights.items():
        sample_input = FabricInput(
            Fabric_Type=fab,
            Fabric_Weight_gsm=float(gsm),
            Yarn_Count=float(yarn_cnt),
            Weave_Type=norm_weave,
            Wash_Temperature_C=float(temp),
            Detergent_Type=norm_det,
            Mechanical_Agitation=float(agit),
            Number_of_Washes=max_washes
        )
        X_tensor = prepare_sequence_tensor(sample_input, max_washes=max_washes)
        with torch.no_grad():
            outputs = model(X_tensor)
        scaled_preds = outputs[0, :, :].numpy()
        raw_preds = target_scaler.inverse_transform(scaled_preds).flatten()
        combined_curve += weight * raw_preds

    predictions = [round(float(p), 2) for p in combined_curve]
    cumulative_preds = [round(float(c), 2) for c in np.cumsum(combined_curve)]
    total_mg = float(np.sum(combined_curve))
    total_g = round(total_mg / 1000.0, 2)
    per_wash_avg = round(total_mg / max_washes, 2)

    # Determine Grade
    assigned_grade = 'E'
    for grade, cfg in GRADE_CONFIG.items():
        if total_g < cfg['max_g']:
            assigned_grade = grade
            break

    grade_meta = GRADE_CONFIG[assigned_grade]

    # Calculate synthetic microplastic percentage
    synthetic_fabrics = {'Polyester': 1.0, 'Acrylic': 1.0, 'Nylon': 1.0, 'Cotton-Poly Blend': 0.5}
    synthetic_ratio = sum(synthetic_fabrics.get(f, 0.0) * w for f, w in weights.items())
    synthetic_g = round(total_g * synthetic_ratio, 2)

    # Stabilization wash calculation
    # Detect wash where shedding delta < 1% of wash 1
    stabilization_wash = None
    wash_values = list(range(1, max_washes + 1))
    for i in range(1, len(predictions)):
        delta = abs(predictions[i] - predictions[i-1])
        if delta < (0.01 * predictions[0]):
            stabilization_wash = i + 1
            break
    if stabilization_wash is None:
        stabilization_wash = min(35, max_washes)

    # Reasons list ("Why this grade")
    reasons = []
    primary_fab = max(weights.items(), key=lambda x: x[1])[0]
    if synthetic_ratio >= 0.5:
        reasons.append({
            "icon": "⚠️",
            "type": "material",
            "title": f"Synthetic fibers ({round(synthetic_ratio * 100)}%)",
            "text": f"{primary_fab} releases persistent, non-biodegradable microplastics that accumulate in marine ecosystems."
        })
    else:
        reasons.append({
            "icon": "🌿",
            "type": "material",
            "title": f"Predominantly natural ({round((1 - synthetic_ratio) * 100)}%)",
            "text": f"{primary_fab} releases natural cellulosic fibers which biodegrade significantly faster than synthetics."
        })

    if temp > 35:
        reasons.append({
            "icon": "🌡️",
            "type": "wash_temp",
            "title": f"Warm wash ({int(temp)}°C)",
            "text": "Warm and hot water weakens fiber bonds, increasing microfiber shedding by up to 25%."
        })
    else:
        reasons.append({
            "icon": "❄️",
            "type": "wash_temp",
            "title": f"Cold wash ({int(temp)}°C)",
            "text": "Cold wash preserves textile structure and significantly curtails fiber breakage."
        })

    if agit > 1.1:
        reasons.append({
            "icon": "🌀",
            "type": "agitation",
            "title": f"High agitation ({agit}x)",
            "text": "Vigorous mechanical cycle causes heavy fiber abrasion and yarn fraying."
        })

    if norm_det == 'Eco':
        reasons.append({
            "icon": "💧",
            "type": "detergent",
            "title": "Eco Detergent",
            "text": "Mild surfactants reduce chemical fiber degradation during laundering."
        })

    # Greener Swaps recommendations
    greener_swaps = []
    if synthetic_ratio > 0:
        greener_swaps.append({
            "title": "Switch to 100% Organic Cotton or Lyocell",
            "type": "fabric",
            "potential_reduction": f"~{round(synthetic_g, 1)}g microplastics eliminated",
            "description": "Natural and closed-loop cellulose fibers eliminate non-biodegradable microplastic shedding entirely."
        })

    if temp > 25:
        # Calculate cold wash delta
        cold_delta_g = round(total_g * 0.18, 2)
        greener_swaps.append({
            "title": "Wash at 20°C (Cold Cycle)",
            "type": "habit",
            "potential_reduction": f"Saves ~{cold_delta_g}g shedding over {max_washes} washes",
            "description": "Dropping wash temperature preserves garment lifespan and reduces microfiber shed by up to 18%."
        })

    greener_swaps.append({
        "title": "Use a Guppyfriend Washing Bag",
        "type": "accessory",
        "potential_reduction": "Filters up to 86% of microfibers",
        "description": "Traps broken microfibers inside the bag while protecting clothes from drum friction."
    })

    return {
        "grade": assigned_grade,
        "grade_label": grade_meta['label'],
        "color": grade_meta['color'],
        "ring_color": grade_meta['ring'],
        "confidence": confidence,
        "uncertainty_range": {
            "low_g": round(max(0.1, total_g * (1.0 - uncertainty_pct)), 2),
            "high_g": round(total_g * (1.0 + uncertainty_pct), 2),
            "margin_pct": int(uncertainty_pct * 100)
        },
        "cumulative_grams": total_g,
        "cumulative_release_mg": round(total_mg, 2),
        "per_wash_avg_mg": per_wash_avg,
        "synthetic_percentage": int(synthetic_ratio * 100),
        "synthetic_microplastics_g": synthetic_g,
        "wash_values": wash_values,
        "predictions": predictions,
        "cumulative_predictions": cumulative_preds,
        "estimated_shelf_life": stabilization_wash,
        "reasons": reasons,
        "greener_swaps": greener_swaps,
        "defaults_used": defaults_used,
        "weights": weights
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Relaxed for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)