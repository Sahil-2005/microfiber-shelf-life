import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
import joblib
import os

# 1. Dataset Preparation
class MicrofiberSequenceDataset(Dataset):
    def __init__(self, X_seq, y_seq):
        self.X_seq = torch.tensor(X_seq, dtype=torch.float32)
        self.y_seq = torch.tensor(y_seq, dtype=torch.float32)

    def __len__(self):
        return len(self.X_seq)

    def __getitem__(self, idx):
        return self.X_seq[idx], self.y_seq[idx]

# 2. LSTM Model Definition
class MicrofiberLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2):
        super(MicrofiberLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # LSTM layer
        self.lstm = nn.LSTM(
            input_size=input_size, 
            hidden_size=hidden_size, 
            num_layers=num_layers, 
            batch_first=True
        )
        
        # Fully connected layer to predict continuous release value
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        # x shape: (batch_size, seq_length, input_size)
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        # out shape: (batch_size, seq_length, hidden_size)
        out, _ = self.lstm(x, (h0, c0))
        
        # Process every time step
        # out shape: (batch_size, seq_length, 1)
        out = self.fc(out)
        return out

def main():
    print("Loading sequence data...")
    df = pd.read_csv("data/microfiber_sequence_dataset.csv")

    categorical_features = ["Fabric_Type", "Weave_Type", "Detergent_Type"]
    numerical_features = ["Fabric_Weight_gsm", "Yarn_Count", "Wash_Temperature_C", "Mechanical_Agitation"]

    # Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numerical_features),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features)
        ]
    )

    # We need to extract the unique static features for each fabric to fit the preprocessor
    # Wash_Number and Microfiber_Release_mg are sequential
    static_df = df.drop_duplicates(subset=["Fabric_ID"])
    preprocessor.fit(static_df)
    
    # Transform all data
    # (Fabric_ID, Wash_Number, ...)
    X_static = preprocessor.transform(df)
    
    # We want input to be [static_features, wash_number] at each timestep
    wash_numbers = df["Wash_Number"].values.reshape(-1, 1)
    
    # Normalize wash number too
    wash_scaler = StandardScaler()
    wash_numbers_scaled = wash_scaler.fit_transform(wash_numbers)
    
    X_full = np.hstack((X_static, wash_numbers_scaled))
    
    y_full_raw = df["Microfiber_Release_mg"].values.reshape(-1, 1)
    
    # Scale the target variable!
    target_scaler = StandardScaler()
    y_full = target_scaler.fit_transform(y_full_raw)
    
    input_size = X_full.shape[1]
    
    # Reshape into sequences
    # Since we have exactly 50 washes per fabric and they are ordered
    seq_length = 50
    num_fabrics = len(df["Fabric_ID"].unique())
    
    X_seq = X_full.reshape(num_fabrics, seq_length, input_size)
    y_seq = y_full.reshape(num_fabrics, seq_length, 1)

    # Train/Test Split (80/20)
    split_idx = int(num_fabrics * 0.8)
    X_train, X_test = X_seq[:split_idx], X_seq[split_idx:]
    y_train, y_test = y_seq[:split_idx], y_seq[split_idx:]

    train_dataset = MicrofiberSequenceDataset(X_train, y_train)
    test_dataset = MicrofiberSequenceDataset(X_test, y_test)

    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=32, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = MicrofiberLSTM(input_size=input_size).to(device)
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.005)

    num_epochs = 20
    print(f"Starting training for {num_epochs} epochs...")

    for epoch in range(num_epochs):
        model.train()
        train_loss = 0.0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(device), batch_y.to(device)
            
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * batch_X.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validation
        model.eval()
        test_loss = 0.0
        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                batch_X, batch_y = batch_X.to(device), batch_y.to(device)
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                test_loss += loss.item() * batch_X.size(0)
        test_loss /= len(test_loader.dataset)
        
        print(f"Epoch {epoch+1}/{num_epochs} - Train Loss (MSE): {train_loss:.4f}, Test Loss: {test_loss:.4f}")

    # Save model and preprocessors
    os.makedirs("models", exist_ok=True)
    torch.save(model.state_dict(), "models/lstm_model.pth")
    joblib.dump(preprocessor, "models/preprocessor.pkl")
    joblib.dump(wash_scaler, "models/wash_scaler.pkl")
    joblib.dump(target_scaler, "models/target_scaler.pkl")
    
    print("LSTM Model and Preprocessors saved successfully to 'models/' directory.")

if __name__ == "__main__":
    main()
