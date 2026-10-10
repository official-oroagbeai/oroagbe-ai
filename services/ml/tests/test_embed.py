import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure services/ml directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app


def test_embed_yoruba_sentence():
    """Verify inference on a Yoruba agricultural sentence preserves diacritics and yields 384 dimensions."""
    yoruba_text = "Àrùn Mósèkì Gbágùdá máa ń fa àwọ̀ pọ́n-ẹlẹ́wà lórí ewé àti ìdínkù nínú ìkórè."

    with TestClient(app) as client:
        response = client.post(
            "/embed",
            json={
                "text": yoruba_text,
                "is_query": False
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert "embedding" in data
        assert isinstance(data["embedding"], list)
        assert len(data["embedding"]) == 384
        assert data["dimensions"] == 384

        for val in data["embedding"]:
            assert isinstance(val, float)


def test_embed_batch_texts():
    """Verify batch inference interface."""
    texts = [
        "Plant healthy cassava cuttings at a 45-degree angle.",
        "Kòkòrò Fall Armyworm máa ń jẹ ewé àgbàdo tútù ní oko."
    ]

    with TestClient(app) as client:
        response = client.post(
            "/embed",
            json={
                "texts": texts,
                "is_query": True
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert "embeddings" in data
        assert len(data["embeddings"]) == 2
        assert len(data["embeddings"][0]) == 384
        assert len(data["embeddings"][1]) == 384


def test_embed_empty_payload_fails():
    with TestClient(app) as client:
        response = client.post("/embed", json={})
        assert response.status_code == 400
