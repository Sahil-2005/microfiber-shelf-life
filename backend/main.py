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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Relaxed for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)