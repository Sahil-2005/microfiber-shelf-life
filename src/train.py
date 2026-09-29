import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from sklearn.pipeline import Pipeline

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor,
    ExtraTreesRegressor
)

from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import numpy as np


# Load data
df = pd.read_csv("data/microfiber_dataset.csv")

X = df.drop("Microfiber_Release_mg", axis=1)
y = df["Microfiber_Release_mg"]


categorical_features = [
    "Fabric_Type",
    "Weave_Type",
    "Detergent_Type"
]

numerical_features = [
    "Fabric_Weight_gsm",
    "Yarn_Count",
    "Wash_Temperature_C",
    "Mechanical_Agitation",
    "Number_of_Washes"
]


preprocessor = ColumnTransformer(
    transformers=[
        (
            "num",
            StandardScaler(),
            numerical_features
        ),
        (
            "cat",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features
        )
    ]
)


X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


models = {

    "Linear Regression": LinearRegression(),

    "Random Forest": RandomForestRegressor(
        n_estimators=300,
        random_state=42
    ),

    "Gradient Boosting": GradientBoostingRegressor(
        n_estimators=200,
        random_state=42
    ),

    "Extra Trees": ExtraTreesRegressor(
        n_estimators=300,
        random_state=42
    )
}


results = {}

best_model = None
best_r2 = -float("inf")
best_name = ""


for name, model in models.items():

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model)
        ]
    )

    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)

    mae = mean_absolute_error(y_test, predictions)

    rmse = np.sqrt(
        mean_squared_error(y_test, predictions)
    )

    r2 = r2_score(y_test, predictions)

    results[name] = {
        "MAE": mae,
        "RMSE": rmse,
        "R2": r2
    }

    print("\n", name)
    print("MAE:", mae)
    print("RMSE:", rmse)
    print("R2:", r2)

    if r2 > best_r2:
        best_r2 = r2
        best_model = pipeline
        best_name = name


print("\n==============================")
print("BEST MODEL:", best_name)
print("R2:", best_r2)
print("==============================")


joblib.dump(
    best_model,
    "models/best_model.pkl"
)

print("Model saved successfully!")