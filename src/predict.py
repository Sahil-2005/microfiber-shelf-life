import pandas as pd
import joblib

model = joblib.load("models/best_model.pkl")


sample = pd.DataFrame([{

    "Fabric_Type": "Polyester",

    "Fabric_Weight_gsm": 140,

    "Yarn_Count": 75,

    "Weave_Type": "Twill",

    "Wash_Temperature_C": 40,

    "Detergent_Type": "Standard",

    "Mechanical_Agitation": 1.0,

    "Number_of_Washes": 10

}])


prediction = model.predict(sample)

print(
    "Predicted Microfiber Release:",
    round(prediction[0], 2),
    "mg"
)