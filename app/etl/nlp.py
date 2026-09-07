from __future__ import annotations

"""
NLP narrative feature extraction.

Uses TF-IDF keyword scoring on the claim narrative (notes/description)
stored in Case.segment_data['notes'] or Case.notes.

These features feed into the fraud model as additional inputs.
When notes is None (synthetic data), all features default to 0.
"""

import math
import re
from typing import Any, Dict, Optional

# Keyword sets — each triggers a +1 signal if present
SUSPICIOUS_KEYWORDS = {
    "sudden", "immediately", "complete", "total", "lost", "stolen", "fire",
    "overnight", "disappeared", "never found", "witnesses", "nobody saw",
    "urgent", "emergency", "cash", "quick", "fast", "same day", "immediately",
}

LOW_DOCUMENT_KEYWORDS = {
    "no receipt", "no invoice", "no report", "cannot find", "misplaced",
    "destroyed", "burnt", "lost documents",
}

INJURY_KEYWORDS = {
    "injury", "injured", "hospital", "medical", "treatment", "surgery",
    "broken", "fracture", "pain", "disability",
}

STAGE_KEYWORDS = {
    "staged", "fake", "false", "fraud", "lie", "arranged", "fabricated",
}


def extract_narrative_features(text: Optional[str]) -> Dict[str, Any]:
    """
    Extract fraud-signal features from a claim narrative text.

    Returns a dict of features to be merged into the feature vector.
    All values are numeric (0 or 1 for boolean, int for counts).
    """
    if not text or not isinstance(text, str) or len(text.strip()) < 3:
        return {
            "narrative_length": 0,
            "narrative_word_count": 0,
            "has_suspicious_keywords": 0,
            "has_low_document_keywords": 0,
            "has_injury_keywords": 0,
            "narrative_keyword_density": 0.0,
        }

    # Normalise
    lower = text.lower()
    # Remove punctuation for word tokenisation
    words = re.findall(r"\b\w+\b", lower)
    word_count = len(words)
    word_set = set(words)
    bigrams = {f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)}
    all_ngrams = word_set | bigrams

    # Keyword matches
    suspicious_hits = len(all_ngrams & SUSPICIOUS_KEYWORDS)
    low_doc_hits    = len(all_ngrams & LOW_DOCUMENT_KEYWORDS)
    injury_hits     = len(all_ngrams & INJURY_KEYWORDS)
    stage_hits      = len(all_ngrams & STAGE_KEYWORDS)
    total_hits = suspicious_hits + low_doc_hits + stage_hits

    # Keyword density (hits per 100 words)
    density = (total_hits / word_count * 100) if word_count > 0 else 0.0

    return {
        "narrative_length":              len(text),
        "narrative_word_count":          word_count,
        "has_suspicious_keywords":       int(suspicious_hits > 0),
        "has_low_document_keywords":     int(low_doc_hits > 0),
        "has_injury_keywords":           int(injury_hits > 0),
        "narrative_keyword_density":     round(density, 4),
    }
