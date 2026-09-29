import numpy as np
import pandas as pd

np.random.seed(42)

N = 3000

fabric_types = ["Cotton", "Polyester", "Cotton-Poly Blend", "Nylon", "Acrylic"]
weave_types = ["Plain", "Twill", "Satin"]
detergents = ["Standard", "Enzyme", "Eco"]

data = []

for _ in range(N):

    fabric = np.random.choice(fabric_types)
    weave = np.random.choice(weave_types)
    detergent = np.random.choice(detergents)

    fabric_weight = np.random.uniform(100, 220)
    yarn_count = np.random.uniform(20, 100)

    wash_temp = np.random.choice([30, 40, 50, 60])

    mechanical_agitation = np.random.uniform(0.5, 1.5)

    num_washes = np.random.randint(1, 51)

    # Fabric factors
    fabric_factor = {
        "Cotton": 1.00,
        "Polyester": 1.25,
        "Cotton-Poly Blend": 1.10,
        "Nylon": 0.95,
        "Acrylic": 1.15
    }[fabric]

    # Weave factors
    weave_factor = {
        "Plain": 1.00,
        "Twill": 1.15,
        "Satin": 1.25
    }[weave]

    # Detergent factors
    detergent_factor = {
        "Standard": 1.00,
        "Enzyme": 1.10,
        "Eco": 0.90
    }[detergent]

    # Temperature effect
    temperature_factor = 1 + 0.01 * (wash_temp - 30)

    # Fabric weight effect
    weight_factor = fabric_weight / 150

    # Yarn effect
    yarn_factor = 100 / yarn_count

    # Wash decay
    wash_decay = np.exp(-0.025 * num_washes)

    # Physics-inspired microfiber release
    microfiber_release = (
        80
        * fabric_factor
        * weave_factor
        * detergent_factor
        * temperature_factor
        * weight_factor
        * yarn_factor
        * mechanical_agitation
        * wash_decay
    )

    # Add measurement noise
    noise = np.random.normal(0, 3)

    microfiber_release += noise

    microfiber_release = max(0.1, microfiber_release)

    data.append([
        fabric,
        fabric_weight,
        yarn_count,
        weave,
        wash_temp,
        detergent,
        mechanical_agitation,
        num_washes,
        microfiber_release
    ])


columns = [
    "Fabric_Type",
    "Fabric_Weight_gsm",
    "Yarn_Count",
    "Weave_Type",
    "Wash_Temperature_C",
    "Detergent_Type",
    "Mechanical_Agitation",
    "Number_of_Washes",
    "Microfiber_Release_mg"
]

df = pd.DataFrame(data, columns=columns)

df.to_csv("data/microfiber_dataset.csv", index=False)

print("Dataset generated successfully!")
print(df.head())
print("\nDataset shape:", df.shape)