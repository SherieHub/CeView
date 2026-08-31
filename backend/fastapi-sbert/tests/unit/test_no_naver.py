"""Naver is no longer a generation target.

The two hardcoded Korean captions this removes were injected on the *success*
path, not as a fallback — every Naver caption the app ever displayed was canned
text. See the spec's Section 2a.

Run with: pytest tests/unit/test_no_naver.py -v
"""
import inspect

from app.routers import content
from app.services import gemini_client


def test_hardcoded_naver_captions_are_gone():
    assert not hasattr(content, "_NAVER_OPTIONS")
    assert not hasattr(content, "_NAVER_OPTION_NAMES")


def test_platform_guides_no_longer_offer_naver():
    guides = gemini_client.get_platform_guides("korea")

    assert "naver" not in guides
    assert set(guides) == {"instagram", "tiktok", "facebook"}


def test_the_caption_prompt_does_not_ask_for_naver():
    source = inspect.getsource(gemini_client.generate_content)

    assert "naver" not in source.lower()


def test_the_schema_example_has_three_platforms():
    assert set(gemini_client._caption_schema_example()) == {
        "instagram", "tiktok", "facebook",
    }
