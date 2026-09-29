import { useState } from "react";

import Header from "./components/Header";
import MicrofiberChart from "./components/MicrofiberChart";
import PredictionForm from "./components/PredictionForm";
import ResultCard from "./components/ResultCard";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [prediction, setPrediction] = useState(null);
  const [shelfLifeData, setShelfLifeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePrediction = async (formData) => {
    setLoading(true);
    setError("");

    try {
      const numericData = {
        ...formData,
        Fabric_Weight_gsm: Number(formData.Fabric_Weight_gsm),
        Yarn_Count: Number(formData.Yarn_Count),
        Wash_Temperature_C: Number(formData.Wash_Temperature_C),
        Mechanical_Agitation: Number(formData.Mechanical_Agitation),
        Number_of_Washes: Number(formData.Number_of_Washes),
      };
      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(numericData),
      };
      const [predictionResponse, shelfLifeResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/predict`, requestOptions),
        fetch(`${API_BASE_URL}/shelf-life`, requestOptions),
      ]);

      if (!predictionResponse.ok || !shelfLifeResponse.ok) {
        throw new Error("The API could not process this fabric profile.");
      }

      const [predictionData, shelfLife] = await Promise.all([
        predictionResponse.json(),
        shelfLifeResponse.json(),
      ]);
      setPrediction(predictionData);
      setShelfLifeData(shelfLife);
    } catch (requestError) {
      console.error("Prediction error:", requestError);
      setError(requestError instanceof TypeError
        ? "Unable to reach the prediction API. Start the backend and try again."
        : requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="page-content">
        <div className="intro">
          <p className="eyebrow">Decision support for textile teams</p>
          <h2>See how every wash changes the story.</h2>
          <p>Translate fabric construction and care conditions into a clear release forecast before the next load leaves the lab.</p>
        </div>

        <PredictionForm onPredict={handlePrediction} disabled={loading} />
        {error && <div className="error-banner" role="alert">{error}</div>}
        {loading && <div className="loading-state"><span className="loader" /> Calculating your release curve...</div>}

        {prediction && !loading && (
          <div className="results-grid">
            <ResultCard
              label="Selected wash profile"
              title="Predicted release"
              value={`${prediction.predicted_microfiber_release_mg} mg`}
              subtitle="Estimated microfiber release for the current cycle."
              accent
            />
            <ResultCard
              label="Model threshold"
              title="Estimated shelf life"
              value={shelfLifeData?.estimated_shelf_life ? `${shelfLifeData.estimated_shelf_life} washes` : "Not reached"}
              subtitle={shelfLifeData ? `The ${shelfLifeData.threshold} mg limit is used as the reference.` : "No threshold result returned."}
            />
          </div>
        )}

        {shelfLifeData && !loading && (
          <>
            <MicrofiberChart
              washValues={shelfLifeData.wash_values}
              predictions={shelfLifeData.predictions}
              threshold={shelfLifeData.threshold}
            />
            
            <div className="shap-container" style={{ marginTop: '3rem', padding: '1rem', background: 'var(--surface-color, #fff)', borderRadius: '12px', border: '1px solid var(--border-color, #eaeaea)' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>AI Explainability (SHAP)</h3>
              <p style={{ color: 'var(--text-secondary, #666)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Our deep learning sequence model uses SHAP values to explain its predictions. This plot shows which physical and chemical features drive the microfiber degradation trajectory the most.
              </p>
              <img src="/shap_summary.png" alt="SHAP Feature Importance" style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
