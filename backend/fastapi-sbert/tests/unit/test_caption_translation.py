"""Caption translate / localize endpoints, prompts and formatting.

Run with: pytest tests/unit/test_caption_translation.py -v
"""
import json

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda

from app.agents.creative_director_agent import node
from app.agents.creative_director_agent.prompts import (
    caption_generation_prompt,
    caption_localization_prompt,
    caption_translation_prompt,
)
from app.config.llm import DEFAULT_GROQ_MODEL, translation_model
from app.main import app
from app.services import caption_translation
from app.services.caption_formatting import transform_captions


class _Wrapper:
    def __init__(self, payload=None, error="GROQ_API_KEY is not set"):
        self.last_error = error
        self._payload = payload
        self.seen = []

    def get_model(self):
        if self._payload is None:
            return None

        def _reply(prompt_value):
            self.seen.append(prompt_value.to_string())
            return AIMessage(content=json.dumps(self._payload))

        return RunnableLambda(_reply)


client = TestClient(app, raise_server_exceptions=False)


def _use(monkeypatch, payload=None):
    w = _Wrapper(payload)
    monkeypatch.setattr(caption_translation, "_llm_wrapper", w)
    return w


def test_translate_returns_english_and_source_language(monkeypatch):
    w = _use(monkeypatch, {"caption_en": "Healing trip to Cebu"})
    r = client.post("/internal/generation/translate",
                    json={"caption": "세부 힐링여행 #세부여행", "platform": "tiktok", "business_name": "Blue Reef"})
    assert r.status_code == 200
    assert r.json() == {"caption_en": "Healing trip to Cebu", "source_language": "ko", "source": "groq"}
    assert "Blue Reef" in w.seen[0]


def test_translate_without_model_is_503_with_cause(monkeypatch):
    _use(monkeypatch, None)
    r = client.post("/internal/generation/translate", json={"caption": "セブ島"})
    assert r.status_code == 503
    assert r.json()["code"] == "MOD31_TRANSLATION_UNAVAILABLE"
    assert r.json()["cause"] == "GROQ_API_KEY is not set"


def test_translate_blank_output_is_failed(monkeypatch):
    _use(monkeypatch, {"caption_en": "  "})
    r = client.post("/internal/generation/translate", json={"caption": "セブ島"})
    assert r.status_code == 503
    assert r.json()["code"] == "MOD31_TRANSLATION_FAILED"


def test_localize_happy_path(monkeypatch):
    _use(monkeypatch, {"caption": "세부에서 힐링해요", "caption_en": "Heal in Cebu"})
    r = client.post("/internal/generation/localize",
                    json={"caption_en": "Heal in Cebu", "target_language": "ko", "original_caption": "세부 여행"})
    assert r.status_code == 200
    assert r.json()["caption"] == "세부에서 힐링해요"
    assert r.json()["target_language"] == "ko"


def test_localize_rejects_unknown_language():
    r = client.post("/internal/generation/localize", json={"caption_en": "x", "target_language": "en"})
    assert r.status_code == 422


def test_localize_output_in_wrong_language_is_failed(monkeypatch):
    _use(monkeypatch, {"caption": "Heal in Cebu", "caption_en": "Heal in Cebu"})
    r = client.post("/internal/generation/localize", json={"caption_en": "Heal in Cebu", "target_language": "ko"})
    assert r.status_code == 503
    assert r.json()["code"] == "MOD31_TRANSLATION_FAILED"


def test_translation_model_precedence(monkeypatch):
    monkeypatch.delenv("GROQ_TRANSLATION_MODEL", raising=False)
    monkeypatch.delenv("GROQ_MODEL", raising=False)
    assert translation_model() == DEFAULT_GROQ_MODEL
    monkeypatch.setenv("GROQ_MODEL", "base")
    assert translation_model() == "base"
    monkeypatch.setenv("GROQ_TRANSLATION_MODEL", "  ")
    assert translation_model() == "base"
    monkeypatch.setenv("GROQ_TRANSLATION_MODEL", "tr")
    assert translation_model() == "tr"


def test_script_detection():
    d = caption_translation.detect_language
    assert d("힐링 #Cebu") == "ko"
    assert d("セブ島で癒し") == "ja"
    assert d("絶景") == "ja"
    assert d("Hello Cebu 🌴") == "en"
    assert not caption_translation.has_non_english_script("café")


def test_transform_captions_options_en_aligned():
    fc = {p: [{"caption": "a", "caption_en": "A"}, {"caption": "b"}, {"caption": "c", "caption_en": 5}]
          for p in ("instagram", "tiktok", "facebook")}
    out = transform_captions(fc, {})
    for p in fc:
        assert out[p]["optionsEn"] == ["A", "", ""]
        assert len(out[p]["optionsEn"]) == len(out[p]["options"])


def test_prompts_format_without_brace_errors():
    msgs = caption_generation_prompt.format_messages(
        target_market="South Korea", business_name="B", market_category="c",
        relevant_priority_services=[], extra_additional_services=[], business_description="d",
        business_uvp="u", forecast_context="", research_context="", caption_language="Korean (한국어)",
        market_score="")
    text = msgs[0].content
    assert "caption_en" in text and "Korean (한국어)" in text
    caption_translation_prompt.format_messages(caption="x", platform="instagram", business_name="B")
    caption_localization_prompt.format_messages(
        caption_en="x", language_name="Korean", market="South Korea", platform="instagram",
        platform_rules="r", original_caption="", business_name="B")


def test_generation_node_defaults_missing_caption_en(monkeypatch):
    matrix = {p: [{"caption": "c"}] for p in ("facebook", "instagram", "tiktok")}
    captured = {}

    class W:
        last_error = None

        def get_model(self):
            def _reply(pv):
                captured["prompt"] = pv.to_string()
                return AIMessage(content=json.dumps(matrix))
            return RunnableLambda(_reply)

    monkeypatch.setattr(node, "_llm_wrapper", W())
    out = node.generate_platform_captions({"target_market": "South Korea", "relevant_priority_services": ["x"]})
    assert out["final_captions"]["instagram"][0]["caption_en"] == ""
    assert "Korean (한국어)" in captured["prompt"]


def test_profile_diff_prefers_english_translation(monkeypatch):
    from app.agents.omcs_agent import node as omcs_node
    seen = []
    monkeypatch.setattr(omcs_node, "profile_alignment_score", lambda profile, text: seen.append(text) or 1.0)
    omcs_node.node_profile_diff({"caption": "세부", "caption_en": "Cebu", "business_profile": {}})
    omcs_node.node_profile_diff({"caption": "세부", "caption_en": "  ", "business_profile": {}})
    omcs_node.node_profile_diff({"caption": "세부", "business_profile": {}})
    assert seen == ["Cebu", "세부", "세부"]
