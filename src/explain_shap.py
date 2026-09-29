import torch
import torch.nn as nn
import shap
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import os
import warnings
warnings.filterwarnings('ignore')

from train_lstm import MicrofiberLSTM, MicrofiberSequenceDataset

def main():
    print("Loading data for SHAP explanation...")
    df = pd.read_csv("data/microfiber_sequence_dataset.csv")
    
    preprocessor = joblib.load("models/preprocessor.pkl")
    wash_scaler = joblib.load("models/wash_scaler.pkl")
    
    # Preprocess a small sample for SHAP
    sample_df = df.head(50 * 5) # 5 fabrics, 50 washes each
    
    static_df = df.drop_duplicates(subset=["Fabric_ID"])
    X_static = preprocessor.transform(sample_df)
    
    wash_numbers = sample_df["Wash_Number"].values.reshape(-1, 1)
    wash_numbers_scaled = wash_scaler.transform(wash_numbers)
    
    X_full = np.hstack((X_static, wash_numbers_scaled))
    input_size = X_full.shape[1]
    
    X_seq = X_full.reshape(5, 50, input_size)
    X_tensor = torch.tensor(X_seq, dtype=torch.float32)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    print("Loading LSTM model...")
    model = MicrofiberLSTM(input_size=input_size).to(device)
    model.load_state_dict(torch.load("models/lstm_model.pth", map_location=device))
    model.eval()
    
    # SHAP DeepExplainer expects a background dataset
    background = X_tensor[:3].to(device)
    test_data = X_tensor[3:5].to(device)
    
    print("Running SHAP Explainer...")
    # Wrap model for SHAP to handle sequence properly
    # We will explain the output at the FINAL wash step (step 49) for simplicity
    class WrappedModel(nn.Module):
        def __init__(self, model):
            super().__init__()
            self.model = model
            
        def forward(self, x):
            # Output only the last time step
            out = self.model(x)
            return out[:, -1, :]
            
    wrapped_model = WrappedModel(model).to(device)
    
    e = shap.DeepExplainer(wrapped_model, background)
    shap_values = e.shap_values(test_data, check_additivity=False)
    
    # Get feature names
    cat_features = preprocessor.named_transformers_['cat'].get_feature_names_out()
    num_features = preprocessor.named_transformers_['num'].get_feature_names_out()
    feature_names = list(num_features) + list(cat_features) + ["Wash_Number"]
    
    # Reshape shap values for plotting. 
    # shap_values is a list of length 1 (1 output). Inside is array of (2, 50, input_size)
    # We want to show feature importance across all time steps or just average
    shap_vals = shap_values[0] if isinstance(shap_values, list) else shap_values
    
    # Average across time steps and samples
    mean_shap = np.abs(shap_vals).mean(axis=(0, 1)).flatten()
    
    plt.figure(figsize=(10, 8))
    plt.barh(feature_names, mean_shap)
    plt.xlabel("Mean |SHAP value| (Average Impact)")
    plt.title("Feature Importance (LSTM sequence to final state)")
    plt.tight_layout()
    
    os.makedirs("frontend/public", exist_ok=True)
    plt.savefig("frontend/public/shap_summary.png")
    print("SHAP explanation plot saved to frontend/public/shap_summary.png")

if __name__ == "__main__":
    main()
