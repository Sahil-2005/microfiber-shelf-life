import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("data/microfiber_dataset.csv")

plt.figure(figsize=(10, 6))

sns.scatterplot(
    data=df,
    x="Number_of_Washes",
    y="Microfiber_Release_mg",
    hue="Fabric_Type"
)

plt.title("Microfiber Release vs Number of Washes")
plt.xlabel("Number of Washes")
plt.ylabel("Microfiber Release (mg)")

plt.savefig("results/microfiber_vs_washes.png")

plt.show()