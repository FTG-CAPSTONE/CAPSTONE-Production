from __future__ import annotations

from typing import Any, Dict, List

# numpy and shap are lazy-imported inside explain_prediction() to keep idle
# process RAM within Render's 512 MB free-tier limit. They only load on the
# first scoring call, then stay cached by Python's module system.


def explain_prediction(
    model,
    feature_vector: Dict[str, Any],
    feature_names: List[str],
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """
    Compute SHAP values for a single prediction.

    Returns top_n features sorted by absolute SHAP impact:
    [
      {"feature": "days_since_inception", "impact": 0.32,
       "value": 3, "direction": "increases_risk"},
      ...
    ]

    If the model has no champion yet, or SHAP fails, returns an empty list
    with a note — the caller handles the graceful fallback.
    """
    try:
        import numpy as np
        import shap
        import pandas as pd

        row = pd.DataFrame([{k: feature_vector.get(k, 0) for k in feature_names}])
        explainer = shap.TreeExplainer(model)
        raw = explainer.shap_values(row)

        # XGBoost binary classifier: raw may be 1-D or 2-D [neg, pos]
        if isinstance(raw, list) and len(raw) == 2:
            vals = raw[1][0]   # positive class SHAP values
        elif hasattr(raw, "ndim") and raw.ndim == 2:
            vals = raw[0]
        else:
            vals = np.array(raw).flatten()

        entries = []
        for fname, fval, shap_val in zip(feature_names, row.iloc[0], vals):
            entries.append({
                "feature": fname,
                "impact": float(abs(shap_val)),
                "raw_shap": float(shap_val),
                "value": float(fval) if fval is not None else 0.0,
                "direction": "increases_risk" if shap_val > 0 else "decreases_risk",
            })

        top = sorted(entries, key=lambda x: x["impact"], reverse=True)[:top_n]
        return top

    except Exception as exc:
        # Never crash the pipeline on SHAP failure
        return [{"feature": "shap_error", "impact": 0.0, "value": str(exc),
                 "direction": "decreases_risk", "note": "SHAP computation failed"}]
