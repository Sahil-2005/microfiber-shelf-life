import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

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
    test_size=0.20,
    random_state=42
)

print("Training samples:", X_train.shape[0])
print("Testing samples:", X_test.shape[0])