"""
test_backend_api.py — Integration tests for FastAPI endpoints:
/predict, /shelf-life, /extract, and /score
"""
import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE_DIR))

from backend.main import (
    app,
    extract_fabric_properties,
    calculate_microfiber_score,
    predict,
    calculate_shelf_life,
    ExtractRequest,
    ScoreRequest,
    FabricInput
)

def test_extract_endpoint():
    print("Testing /extract endpoint...")
    req = ExtractRequest(text="Men 60% Cotton 40% Polyester Athletic T-Shirt 180 GSM Plain Weave")
    res = extract_fabric_properties(req)
    assert res["fabric_type"] in ["Cotton", "Cotton-Poly Blend", "Polyester"], f"Unexpected fabric: {res['fabric_type']}"
    assert res["gsm"] == 180.0, f"Expected 180 GSM, got {res['gsm']}"
    assert res["weave"] == "Plain", f"Expected Plain weave, got {res['weave']}"
    assert res["confidence"] == "high", f"Expected high confidence, got {res['confidence']}"
    print("  ✓ /extract passed")

def test_score_blend_endpoint():
    print("Testing /score with blend...")
    req = ScoreRequest(
        Blend={"Cotton": 0.6, "Polyester": 0.4},
        Fabric_Weight_gsm=180,
        Yarn_Count=30,
        Weave_Type="Plain",
        Wash_Temperature_C=40,
        Detergent_Type="Standard",
        Mechanical_Agitation=1.0,
        Number_of_Washes=50
    )
    res = calculate_microfiber_score(req)
    assert res["grade"] in ["A", "B", "C", "D", "E"], f"Invalid grade: {res['grade']}"
    assert res["cumulative_grams"] > 0, "Cumulative grams must be > 0"
    assert len(res["predictions"]) == 50, f"Expected 50 predictions, got {len(res['predictions'])}"
    assert res["synthetic_percentage"] == 40, f"Expected 40% synthetic, got {res['synthetic_percentage']}"
    assert len(res["reasons"]) > 0, "Reasons should not be empty"
    assert len(res["greener_swaps"]) > 0, "Greener swaps should not be empty"
    print(f"  ✓ /score blend passed (Grade: {res['grade']}, Cumulative: {res['cumulative_grams']}g)")

def test_score_fallback_defaults():
    print("Testing /score with missing fields (intelligent defaults)...")
    req = ScoreRequest(raw_text="100% Recycled Polyester Fleece Jacket 320 gsm")
    res = calculate_microfiber_score(req)
    assert res["grade"] in ["D", "E"], f"Heavy fleece should be Grade D/E, got {res['grade']}"
    assert len(res["defaults_used"]) > 0, "Should track defaults used"
    assert res["confidence"] in ["medium", "high"]
    print(f"  ✓ /score defaults fallback passed (Grade: {res['grade']}, Defaults: {len(res['defaults_used'])})")

def test_original_predict_endpoint():
    print("Testing original /predict endpoint...")
    data = FabricInput(
        Fabric_Type="Cotton",
        Fabric_Weight_gsm=150.0,
        Yarn_Count=30.0,
        Weave_Type="Plain",
        Wash_Temperature_C=40.0,
        Detergent_Type="Standard",
        Mechanical_Agitation=1.0,
        Number_of_Washes=10
    )
    res = predict(data)
    assert "predicted_microfiber_release_mg" in res
    assert res["predicted_microfiber_release_mg"] > 0
    print(f"  ✓ /predict passed ({res['predicted_microfiber_release_mg']} mg)")

def test_original_shelf_life_endpoint():
    print("Testing original /shelf-life endpoint...")
    data = FabricInput(
        Fabric_Type="Polyester",
        Fabric_Weight_gsm=200.0,
        Yarn_Count=30.0,
        Weave_Type="Plain",
        Wash_Temperature_C=40.0,
        Detergent_Type="Standard",
        Mechanical_Agitation=1.0,
        Number_of_Washes=50
    )
    res = calculate_shelf_life(data)
    assert len(res["predictions"]) == 50
    assert len(res["wash_values"]) == 50
    assert "threshold" in res
    print(f"  ✓ /shelf-life passed (50 wash steps computed)")

if __name__ == "__main__":
    print("\n========================================")
    print("🧪 Running Backend API Integration Tests")
    print("========================================\n")
    test_extract_endpoint()
    test_score_blend_endpoint()
    test_score_fallback_defaults()
    test_original_predict_endpoint()
    test_original_shelf_life_endpoint()
    print("\n========================================")
    print("🎉 All 5 Backend Tests Passed Successfully!")
    print("========================================\n")
