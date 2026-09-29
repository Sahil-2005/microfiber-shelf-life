import numpy as np
import pandas as pd
import os

np.random.seed(42)

NUM_FABRICS = 1500
MAX_WASHES = 50

fabric_types = ["Cotton", "Polyester", "Cotton-Poly Blend", "Nylon", "Acrylic"]
weave_types = ["Plain", "Twill", "Satin"]
detergents = ["Standard", "Enzyme", "Eco"]

data = []
fabric_id = 1

for _ in range(NUM_FABRICS):
    fabric = np.random.choice(fabric_types)
    weave = np.random.choice(weave_types)
    detergent = np.random.choice(detergents)

    fabric_weight = np.random.uniform(100, 220)
    yarn_count = np.random.uniform(20, 100)
    wash_temp = np.random.choice([30, 40, 50, 60])
    mechanical_agitation = np.random.uniform(0.5, 1.5)

    # Base factors
    fabric_factor = {"Cotton": 1.0, "Polyester": 1.25, "Cotton-Poly Blend": 1.1, "Nylon": 0.95, "Acrylic": 1.15}[fabric]
    weave_factor = {"Plain": 1.0, "Twill": 1.15, "Satin": 1.25}[weave]
    detergent_factor = {"Standard": 1.0, "Enzyme": 1.1, "Eco": 0.9}[detergent]
    temp_factor = 1 + 0.01 * (wash_temp - 30)
    weight_factor = fabric_weight / 150
    yarn_factor = 100 / yarn_count

    # Determine how many washes this fabric goes through before throwing away
    # For training sequence models, it's good to have fixed length or pad. 
    # Let's generate a full 50 washes for all so we can predict the curve.
    num_washes = 50
    
    cumulative_wear = 0.0

    for wash_idx in range(1, num_washes + 1):
        # Base release formula
        base_release = 80 * fabric_factor * weave_factor * detergent_factor * temp_factor * weight_factor * yarn_factor * mechanical_agitation
        
        # Exponential decay (initial loose fibers wash out)
        wash_decay = np.exp(-0.05 * wash_idx)
        
        # Accumulate wear: as it's washed more, it gets structurally weaker and might release more again later or differently.
        # This makes it a true time-series problem.
        cumulative_wear += base_release * 0.01
        
        # Microfiber release at this wash step
        release_at_t = base_release * wash_decay + cumulative_wear * 1.5 
        
        # Add noise
        noise = np.random.normal(0, 2)
        release_at_t += noise
        release_at_t = max(0.1, release_at_t)

        data.append([
            fabric_id, fabric, fabric_weight, yarn_count, weave, wash_temp, 
            detergent, mechanical_agitation, wash_idx, release_at_t
        ])
    
    fabric_id += 1

columns = [
    "Fabric_ID", "Fabric_Type", "Fabric_Weight_gsm", "Yarn_Count", "Weave_Type", 
    "Wash_Temperature_C", "Detergent_Type", "Mechanical_Agitation", 
    "Wash_Number", "Microfiber_Release_mg"
]

df = pd.DataFrame(data, columns=columns)

os.makedirs("data", exist_ok=True)
df.to_csv("data/microfiber_sequence_dataset.csv", index=False)

print("Sequence dataset generated successfully!")
print(f"Shape: {df.shape}, Total Fabrics: {NUM_FABRICS}")
