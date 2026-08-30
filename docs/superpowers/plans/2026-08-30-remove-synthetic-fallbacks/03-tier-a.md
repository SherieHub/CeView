# Phase 2 — Tier A: AI Generation Fallbacks (Tasks 17–25)

Every canned AI output is deleted. An unreachable model produces a 503 naming the
model and the reason, never text that looks like generation.

**Prerequisite:** Phases 0 and 1 complete (Tasks 1–16).

> **Expect Content Studio to go red after Task 18.** The caption agent has a known
> open bug — `MOD31_CAPTION_AGENT_FAILED`, "missing platform 'tiktok'" — that the
> fallback was hiding. Surfacing it is this plan working correctly. Fixing the
> agent's prompt is explicitly out of scope (see `00-index.md`).

---

### Task 17: Split `_mock_captions` into a prompt-only schema example

The dict serves two purposes today: it is the JSON shape example embedded in the
prompt (legitimate) and the value returned when the model is unreachable (not). Only
the second use goes.

**Files:**
- Modify: `backend/fastapi-sbert/app/services/gemini_client.py:100-260`
- Test: `backend/fastapi-sbert/tests/unit/test_no_caption_fallback.py`

- [ ] **Step 1: Write the failing test**

```python
"""Content generation returns a real model output or raises. No third option.

Run with: pytest tests/unit/test_no_caption_fallback.py -v
"""
import pytest

from app.services import gemini_client
from app.unavailable import DependencyUnavailable


def test_raises_when_gemini_is_disabled(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: False)

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_content(
            market="korea", business_name="Test Dive Co",
            description="Diving in Cebu", categories=["Coastal & Island"], trend="surging",
        )

    assert excinfo.value.dependency == "groq"
    assert excinfo.value.code == "MOD3_CONTENT_GEMINI_DISABLED"


def test_raises_when_the_model_call_explodes(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)

    def _boom(_prompt):
        raise RuntimeError("404 model_not_found")

    monkeypatch.setattr(gemini_client, "_generate_json", _boom)

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_content(
            market="korea", business_name="T", description="d",
            categories=["c"], trend="t",
        )

    assert "404 model_not_found" in excinfo.value.cause


def test_raises_when_the_model_returns_nothing_usable(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: True)
    monkeypatch.setattr(gemini_client, "_generate_json", lambda _p: {})

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_content(
            market="korea", business_name="T", description="d",
            categories=["c"], trend="t",
        )

    assert excinfo.value.code == "MOD3_CONTENT_GEMINI_EMPTY"


def test_mock_captions_no_longer_exists():
    assert not hasattr(gemini_client, "_mock_captions")


def test_the_schema_example_carries_no_prose_captions():
    example = gemini_client._caption_schema_example()

    for platform in ("instagram", "tiktok", "facebook"):
        for option in example[platform]["options"]:
            assert option == "<string>", "the prompt example must be types, not sample copy"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_no_caption_fallback.py -v
```

Expected: FAIL — `_caption_schema_example` does not exist; the fallback returns
instead of raising.

- [ ] **Step 3: Replace `_mock_captions` with the schema example**

In `gemini_client.py`, rename `_mock_captions` (:268) to `_caption_schema_example`
and replace every sample caption string with the literal `"<string>"`, keeping the
structure and the `optionNames` arrays intact:

```python
def _caption_schema_example() -> dict:
    """The JSON shape the caption prompt asks the model to fill.

    Types, not sample copy. This used to hold finished captions and doubled as the
    fallback payload — which meant a disabled model returned a prompt example to
    the operator as if it were generated content. The fallback is gone (Task 17);
    this survives only to show the model the shape it must return.
    """
    per_platform = {
        "options": ["<string>", "<string>", "<string>"],
        "optionNames": _DEMOGRAPHIC_OPTION_NAMES,
        "guide": ["<string>", "<string>", "<string>", "<string>", "<string>"],
    }
    return {
        "instagram": dict(per_platform),
        "tiktok": dict(per_platform),
        "facebook": dict(per_platform),
    }
```

- [ ] **Step 4: Replace the three fallback returns**

At the top of `gemini_client.py`:

```python
from app.unavailable import DependencyUnavailable
```

Replace the `if not _enabled():` return (:120-127) with:

```python
    if not _enabled():
        raise DependencyUnavailable(
            code=errors.MOD3_CONTENT_GEMINI_DISABLED,
            message="Content generation is unavailable.",
            dependency="groq",
            cause="GROQ_API_KEY is not set, so the content client is disabled",
            stage="fastapi-sbert/gemini_client.generate_content",
        )
```

Replace the exception return (:234-241) with:

```python
    try:
        enriched = _generate_json(prompt)
    except Exception as exc:
        raise DependencyUnavailable(
            code=errors.MOD3_CONTENT_GEMINI_EXCEPTION,
            message="Content generation failed.",
            dependency="groq",
            cause=str(exc),
            stage="fastapi-sbert/gemini_client.generate_content",
        ) from exc
```

Replace the empty-payload return (:243-250) with:

```python
    if not enriched or not enriched.get("captions"):
        raise DependencyUnavailable(
            code=errors.MOD3_CONTENT_GEMINI_EMPTY,
            message="Content generation returned no captions.",
            dependency="groq",
            cause=f"model returned {'an empty body' if not enriched else 'no captions key'}",
            stage="fastapi-sbert/gemini_client.generate_content",
        )
```

Finally, change the `base` dict at :111-118 to use the schema example and drop the
captions key from the returned payload (the success return at :252-257 already
supplies `enriched.get("captions")`):

```python
    base = {
        "market": { ... unchanged ... },
        "framework": "SOR — Stimulus-Organism-Response",
        "captions": _caption_schema_example(),   # prompt shape only; never returned
    }
```

- [ ] **Step 5: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_no_caption_fallback.py -v
```

Expected: PASS — 5 passed

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/services/gemini_client.py backend/fastapi-sbert/tests/unit/test_no_caption_fallback.py
git commit -m "feat(module-3): content generation raises instead of returning mock captions"
```

---

### Task 18: Delete `_fallback_captions` from the caption agent

**Files:**
- Modify: `backend/fastapi-sbert/app/agents/creative_director_agent/node.py:85-125`
- Test: `backend/fastapi-sbert/tests/unit/test_caption_agent_no_fallback.py`

- [ ] **Step 1: Write the failing test**

```python
"""The caption agent raises when it has no model, naming why.

Task 3 made AgentLLMModel record its failure reason; this is what consumes it.

Run with: pytest tests/unit/test_caption_agent_no_fallback.py -v
"""
import pytest

from app.agents.creative_director_agent import node
from app.unavailable import DependencyUnavailable


class _NoModel:
    last_error = "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found"

    def get_model(self):
        return None


def test_raises_with_the_wrappers_reason(monkeypatch):
    monkeypatch.setattr(node, "_llm_wrapper", _NoModel())

    with pytest.raises(DependencyUnavailable) as excinfo:
        node.generate_platform_captions({"target_market": "korea"})

    assert excinfo.value.code == "MOD31_LLM_UNAVAILABLE"
    assert excinfo.value.dependency == "groq"
    assert "404 model_not_found" in excinfo.value.cause


def test_fallback_helper_no_longer_exists():
    assert not hasattr(node, "_fallback_captions")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_caption_agent_no_fallback.py -v
```

Expected: FAIL — returns fallback captions rather than raising

- [ ] **Step 3: Implement**

Delete `_fallback_captions` (:89-102) entirely. Replace the `if llm is None:` block
(:113-121) with:

```python
    llm = _llm_wrapper.get_model()
    if llm is None:
        raise DependencyUnavailable(
            code=errors.MOD31_LLM_UNAVAILABLE,
            message="Caption generation is unavailable.",
            dependency="groq",
            cause=getattr(_llm_wrapper, "last_error", None) or "the Groq client is not initialised",
            stage="fastapi-sbert/caption_agent",
        )
```

Add the import at the top:

```python
from app.unavailable import DependencyUnavailable
```

Update the function docstring's last line — "Falls back to curated mock captions
when the LLM is unavailable" becomes "Raises DependencyUnavailable when the LLM is
unavailable; never substitutes canned copy."

- [ ] **Step 4: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_caption_agent_no_fallback.py -v
```

Expected: PASS — 2 passed

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/agents/creative_director_agent/node.py backend/fastapi-sbert/tests/unit/test_caption_agent_no_fallback.py
git commit -m "feat(module-3): caption agent raises instead of returning mock captions"
```

---

### Task 19: Delete `_FALLBACK_SERVICES`; empty services is a 424

These invent business services ("resort stay", "beach activities") that then appear
in captions attributed to the operator's real business.

**Files:**
- Modify: `backend/fastapi-sbert/app/agents/creative_director_agent/node.py:30,45-47,139`
- Test: `backend/fastapi-sbert/tests/unit/test_no_invented_services.py`

- [ ] **Step 1: Write the failing test**

```python
"""A business with no recorded services must not have services invented for it.

The prior behaviour put "resort stay" into captions published under a real
operator's name.

Run with: pytest tests/unit/test_no_invented_services.py -v
"""
import pytest

from app.agents.creative_director_agent import node
from app.unavailable import DependencyUnavailable


def test_empty_services_is_a_424_not_an_invention():
    with pytest.raises(DependencyUnavailable) as excinfo:
        node.analyze_services({"core_services": [], "extra_additional_services": []})

    assert excinfo.value.status_code == 424
    assert excinfo.value.dependency == "business_profile"
    assert "core services" in excinfo.value.cause.lower()


def test_fallback_services_constant_no_longer_exists():
    assert not hasattr(node, "_FALLBACK_SERVICES")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_no_invented_services.py -v
```

Expected: FAIL — `_FALLBACK_SERVICES` still exists

- [ ] **Step 3: Implement**

Delete `_FALLBACK_SERVICES` at :30. Replace the substitution at :45-47 with:

```python
    if not all_services:
        raise DependencyUnavailable(
            code="MOD31_NO_CORE_SERVICES",
            message="This business profile has no core services recorded.",
            dependency="business_profile",
            cause="both coreServices and extra_additional_services were empty — "
                  "complete the business profile before generating content",
            stage="fastapi-sbert/caption_agent.analyze_services",
            status_code=424,
        )
```

At :139, replace the `.get()` default with the real value — by the time this line
runs, `analyze_services` has already guaranteed a non-empty list:

```python
            "relevant_priority_services": state["relevant_priority_services"],
```

Add `MOD31_NO_CORE_SERVICES = "MOD31_NO_CORE_SERVICES"` to
`backend/fastapi-sbert/app/errors.py` in the Module 3.1 block, and reference it as
`errors.MOD31_NO_CORE_SERVICES` rather than the string literal above.

- [ ] **Step 4: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/ -v
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/agents/creative_director_agent/node.py backend/fastapi-sbert/app/errors.py backend/fastapi-sbert/tests/unit/test_no_invented_services.py
git commit -m "feat(module-3): never invent business services for a caption"
```

---

### Task 20: Delete `_creative_fallback`

**Files:**
- Modify: `backend/fastapi-sbert/app/services/gemini_client.py:755-770,825+`
- Test: `backend/fastapi-sbert/tests/unit/test_no_creative_fallback.py`

- [ ] **Step 1: Write the failing test**

```python
"""Creative direction is generated or unavailable — never a curated template.

Run with: pytest tests/unit/test_no_creative_fallback.py -v
"""
import pytest

from app.services import gemini_client
from app.unavailable import DependencyUnavailable


def test_raises_when_disabled(monkeypatch):
    monkeypatch.setattr(gemini_client, "_enabled", lambda: False)

    with pytest.raises(DependencyUnavailable) as excinfo:
        gemini_client.generate_creative_direction(
            market="korea", business_name="T", categories=["c"],
            approved_captions=[], uniqueness_score=0, forecast_context={},
        )

    assert excinfo.value.code == "MOD3_CREATIVE_GEMINI_DISABLED"
    assert excinfo.value.dependency == "groq"


def test_creative_fallback_helper_no_longer_exists():
    assert not hasattr(gemini_client, "_creative_fallback")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_no_creative_fallback.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement**

Delete `_creative_fallback` (:825 to the end of that function) and the
`fallback = _creative_fallback(market, platforms)` line at :760. Replace the
`if not _enabled():` return at :762-768 with:

```python
    if not _enabled():
        raise DependencyUnavailable(
            code=errors.MOD3_CREATIVE_GEMINI_DISABLED,
            message="Creative direction is unavailable.",
            dependency="groq",
            cause="GROQ_API_KEY is not set, so the creative client is disabled",
            stage="fastapi-sbert/gemini_client.generate_creative_direction",
        )
```

Any later `return {**fallback, ...}` in this function becomes a raise following the
same pattern, with `errors.MOD3_CREATIVE_GEMINI_EXCEPTION` or
`errors.MOD3_CREATIVE_GEMINI_EMPTY` as appropriate.

The `platforms` dict at :754 (`korea → Naver Blog primary…`) is a *recommendation*
map, not fabricated output. It stays — see spec D6.

- [ ] **Step 4: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_no_creative_fallback.py -v
```

Expected: PASS — 2 passed

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/services/gemini_client.py backend/fastapi-sbert/tests/unit/test_no_creative_fallback.py
git commit -m "feat(module-3): creative direction raises instead of returning templates"
```

---

### Task 21: Delete `_FALLBACK_PAYLOAD` from `pes_analysis`

**Files:**
- Modify: `backend/fastapi-sbert/app/routers/pes_analysis.py:59-150`
- Test: `backend/fastapi-sbert/tests/unit/test_pes_analysis_no_fallback.py`

- [ ] **Step 1: Write the failing test**

```python
"""PES analysis reports its unavailability rather than an "offline" placeholder.

Run with: pytest tests/unit/test_pes_analysis_no_fallback.py -v
"""
import pytest

from app.routers import pes_analysis
from app.unavailable import DependencyUnavailable


@pytest.mark.asyncio
async def test_empty_metrics_is_a_424():
    request = pes_analysis.PesAnalysisRequest(metrics_data={}, weeks=4)

    with pytest.raises(DependencyUnavailable) as excinfo:
        await pes_analysis.generate(request)

    assert excinfo.value.status_code == 424
    assert excinfo.value.dependency == "campaign_records"


@pytest.mark.asyncio
async def test_agent_failure_is_a_503_naming_the_reason(monkeypatch):
    async def _boom(_state):
        raise RuntimeError("gemini timeout after 3 retries")

    monkeypatch.setattr(pes_analysis.pes_agent_graph, "ainvoke", _boom)
    request = pes_analysis.PesAnalysisRequest(metrics_data={"ctr": [1.0, 2.0]}, weeks=4)

    with pytest.raises(DependencyUnavailable) as excinfo:
        await pes_analysis.generate(request)

    assert excinfo.value.status_code == 503
    assert "gemini timeout" in excinfo.value.cause


def test_fallback_payload_no_longer_exists():
    assert not hasattr(pes_analysis, "_FALLBACK_PAYLOAD")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_pes_analysis_no_fallback.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement**

Delete `_FALLBACK_PAYLOAD` (:61-79). Replace the three `return _FALLBACK_PAYLOAD`
sites:

At :117-118 (empty metrics):

```python
    if not req.metrics_data:
        raise DependencyUnavailable(
            code="MOD4_PES_NO_METRICS",
            message="No campaign metrics to analyse.",
            dependency="campaign_records",
            cause="metrics_data was empty — ingest at least one campaign before "
                  "requesting a PES analysis",
            stage="fastapi-sbert/pes_analysis",
            status_code=424,
        )
```

At :136 and :148 (agent raised, or returned no payload):

```python
    except Exception as exc:
        raise DependencyUnavailable(
            code="MOD4_PES_AGENT_FAILED",
            message="PES analysis is unavailable.",
            dependency="gemini",
            cause=str(exc),
            stage="fastapi-sbert/pes_analysis",
        ) from exc
```

```python
    if not payload:
        raise DependencyUnavailable(
            code="MOD4_PES_AGENT_EMPTY",
            message="PES analysis returned no payload.",
            dependency="gemini",
            cause="the agent completed but produced no final_ui_payload",
            stage="fastapi-sbert/pes_analysis",
        )
```

Add `MOD4_PES_NO_METRICS`, `MOD4_PES_AGENT_FAILED` and `MOD4_PES_AGENT_EMPTY` to
`app/errors.py` under a Module 4 heading, and use `errors.X` rather than literals.
Add the `DependencyUnavailable` import. Update the docstring's "Fallback behaviour"
block to describe the raises.

- [ ] **Step 4: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_pes_analysis_no_fallback.py -v
```

Expected: PASS — 3 passed. If `pytest-asyncio` is not configured, add
`asyncio_mode = "auto"` under `[tool.pytest.ini_options]` in
`backend/fastapi-sbert/pyproject.toml`.

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/routers/pes_analysis.py backend/fastapi-sbert/app/errors.py backend/fastapi-sbert/tests/unit/test_pes_analysis_no_fallback.py
git commit -m "feat(module-4): PES analysis raises instead of returning an offline payload"
```

---

### Task 22: Delete `_FALLBACK_REPORT` / `_FALLBACK_EVALUATION`

**Files:**
- Modify: `backend/fastapi-sbert/app/agents/pes_report_agent/nodes.py:24-90`
- Test: `backend/fastapi-sbert/tests/unit/test_pes_report_agent_no_fallback.py`

- [ ] **Step 1: Write the failing test**

```python
"""The report agent's nodes raise; the router (Task 21) renders the 503.

Run with: pytest tests/unit/test_pes_report_agent_no_fallback.py -v
"""
from app.agents.pes_report_agent import nodes


def test_no_fallback_constants_survive():
    assert not hasattr(nodes, "_FALLBACK_REPORT")
    assert not hasattr(nodes, "_FALLBACK_EVALUATION")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_pes_report_agent_no_fallback.py -v
```

Expected: FAIL — both constants exist

- [ ] **Step 3: Implement**

Delete `_FALLBACK_REPORT` (:26-34) and `_FALLBACK_EVALUATION` (:35-40). Replace the
return at :69 with a raise:

```python
        raise DependencyUnavailable(
            code=errors.MOD4_PES_AGENT_FAILED,
            message="PES report generation is unavailable.",
            dependency="gemini",
            cause="the report node produced no structured output",
            stage="fastapi-sbert/pes_report_agent.generate",
        )
```

and the return at :89:

```python
        raise DependencyUnavailable(
            code=errors.MOD4_PES_AGENT_FAILED,
            message="PES report evaluation is unavailable.",
            dependency="gemini",
            cause="the evaluate node produced no structured output",
            stage="fastapi-sbert/pes_report_agent.evaluate",
        )
```

Add the `DependencyUnavailable` and `errors` imports.

- [ ] **Step 4: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/ -v
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/agents/pes_report_agent/nodes.py backend/fastapi-sbert/tests/unit/test_pes_report_agent_no_fallback.py
git commit -m "feat(module-4): PES report agent raises instead of emitting a placeholder report"
```

---

### Task 23: Delete `_fallback_report` from `report.py`

**Files:**
- Modify: `backend/fastapi-sbert/app/routers/report.py:88-195`
- Test: `backend/fastapi-sbert/tests/unit/test_report_no_fallback.py`

- [ ] **Step 1: Write the failing test**

```python
"""The prescriptive report is generated or unavailable.

Run with: pytest tests/unit/test_report_no_fallback.py -v
"""
from app.routers import report


def test_fallback_report_helper_no_longer_exists():
    assert not hasattr(report, "_fallback_report")
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_report_no_fallback.py -v
```

Expected: FAIL

- [ ] **Step 3: Implement**

Delete `_fallback_report` (:91 through the end of that function). Replace the
`return _fallback_report(transitions, req.market)` at :190 with:

```python
        raise DependencyUnavailable(
            code=errors.MOD4_REPORT_UNAVAILABLE,
            message="The prescriptive report is unavailable.",
            dependency="gemini",
            cause="the report LLM is offline or returned no usable structure",
            stage="fastapi-sbert/report.generate",
        )
```

Add `MOD4_REPORT_UNAVAILABLE` to `app/errors.py`. `_PLATFORM_MAP` at :80-81 stays —
it is channel analysis, not fabricated output (spec D6).

- [ ] **Step 4: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/ -v
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/routers/report.py backend/fastapi-sbert/app/errors.py backend/fastapi-sbert/tests/unit/test_report_no_fallback.py
git commit -m "feat(module-4): report generation raises instead of returning a deterministic stand-in"
```

---

### Task 24: Delete Spring's rule-based report fallbacks

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/report/PrescriptiveReportController.java:63-118`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module4/report/PrescriptiveReportService.java:27-120`
- Test: `backend/spring-boot/src/test/java/com/ceview/module4/report/NoRuleBasedFallbackTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module4.report;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FR4.26's "fallback mechanism" is removed. A rule-based report is not an AI
 * report, and rendering one under the same heading misrepresents it.
 *
 * The broad catch(Exception) it lived inside also swallowed genuine bugs — its
 * removal is a correctness win beyond the fabrication question.
 */
class NoRuleBasedFallbackTest {

    @Test
    void serviceNoLongerOffersFallbackBuilders() {
        assertThat(Arrays.stream(PrescriptiveReportService.class.getDeclaredMethods())
                .map(Method::getName))
                .doesNotContain("buildRuleBasedReport", "buildOfflinePesAnalysisFallback");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=NoRuleBasedFallbackTest
```

Expected: FAIL — both methods present

- [ ] **Step 3: Implement**

In `PrescriptiveReportController.java`, replace the `report` method's try/catch
(:75-82) with a bare call — `AiDependencyException` from Task 4 propagates to the
handler on its own:

```java
        return ai.generateReport(payload);
```

Replace the `pesAnalysis` method's try/catch (:110-117) likewise:

```java
        return ai.generatePesAnalysis(Map.of("metrics_data", timeSeries, "weeks", weeks));
```

Delete `buildRuleBasedReport` (:31-100) and `buildOfflinePesAnalysisFallback`
(:101-120) from `PrescriptiveReportService.java`. If the class is then empty, delete
the file and its `@Autowired` field on the controller. Remove the FR4.26 "Fallback
Mechanism" javadoc block at :24 and the two "if FastAPI is unavailable" doc lines.

- [ ] **Step 4: Correct the `PESComputationService` comment**

In `backend/spring-boot/src/main/java/com/ceview/module4/pes/PESComputationService.java`,
replace the ":16" doc line describing it as the FR4.26 fallback:

```java
 * <p>This is the deterministic PES formula from ARCHITECTURE_SPEC.md — arithmetic
 * over real campaign records, not a stand-in for an AI output. It was previously
 * documented as "the FR4.26 rule-based fallback", which invited deleting it
 * alongside the actual fallbacks removed in Task 24. It is not one. Keep it.
```

Delete the same mischaracterisation from the `@param metrics` line at :63.

- [ ] **Step 5: Run the tests**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module4/ backend/spring-boot/src/test/java/com/ceview/module4/report/NoRuleBasedFallbackTest.java
git commit -m "feat(module-4): remove the rule-based report fallbacks"
```

---

### Task 25: `Literal` source types + Spring `ContentSource` enum

The primary defense: a fallback becomes unrepresentable rather than merely forbidden.

**Files:**
- Modify: `backend/fastapi-sbert/app/routers/content.py:93`
- Modify: `backend/fastapi-sbert/app/routers/creative.py:62`
- Modify: `backend/fastapi-sbert/app/agents/creative_director_agent/state.py:42`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module3/dto/ContentDtos.java:66`
- Test: `backend/fastapi-sbert/tests/unit/test_source_is_closed.py`

- [ ] **Step 1: Write the failing test**

```python
"""`source` cannot hold "fallback" any more — Pydantic rejects it at runtime.

This is the mechanism that outlives any grep guard: reintroducing a fallback would
require widening this type, which is a visible and arguable diff.

Run with: pytest tests/unit/test_source_is_closed.py -v
"""
import pytest
from pydantic import ValidationError

from app.routers.content import ContentResponse
from app.routers.creative import CreativeDirectionResponse


def test_content_source_rejects_fallback():
    with pytest.raises(ValidationError):
        ContentResponse(market={}, framework="SOR", captions={}, source="fallback")


def test_content_source_accepts_groq():
    assert ContentResponse(market={}, framework="SOR", captions={}, source="groq").source == "groq"


def test_creative_source_rejects_fallback():
    with pytest.raises(ValidationError):
        CreativeDirectionResponse(
            visualGuide=[], shots=[], moodboard={}, platformRecommendations={},
            source="fallback",
        )


def test_source_has_no_default():
    """A default of "fallback" is how the old shape let an unset source pass."""
    with pytest.raises(ValidationError):
        ContentResponse(market={}, framework="SOR", captions={})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_source_is_closed.py -v
```

Expected: FAIL — `source` is a `str` defaulting to `"fallback"`

- [ ] **Step 3: Implement in Python**

In `content.py`, replace `source: str = "fallback"` at :93 with:

```python
    # Closed on purpose, and with no default. "fallback" was both the type's only
    # other value and its default, which meant an unset source silently shipped as
    # synthetic. Widening this is the visible diff that reintroducing a fallback
    # would require. See the spec's Section 5.
    source: Literal["groq"]
```

Add `from typing import Literal` to the imports. Apply the same change to
`creative.py:62`. In `state.py:42`, change the comment
`# "groq" | "fallback"` to `# always "groq"; unavailability raises instead`.

Update the two router docstrings that document `source — "gemini" | "fallback"`
(`content.py:206`, `creative.py:86`) to read `source — always "groq"`.

- [ ] **Step 4: Run the Python tests**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_source_is_closed.py -v
```

Expected: PASS — 4 passed

- [ ] **Step 5: Implement in Spring**

In `ContentDtos.java`, replace the `source` field's type at :66 with an enum
declared in the same file:

```java
    /**
     * Where the captions came from. There is exactly one legal value: the model
     * produced them. Unavailability is an AiDependencyException, not a source.
     *
     * <p>Adding a FALLBACK constant here is the change that reintroducing a
     * fallback would require — which is the point.
     */
    public enum ContentSource { GROQ }
```

and change the record component from `String source` to `ContentSource source`,
fixing the construction sites the compiler flags.

- [ ] **Step 6: Run the Spring tests**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS

- [ ] **Step 7: Verify end to end against the live stack**

```bash
cd backend && docker compose up -d && sleep 90
curl -s -X POST localhost:8080/api/content/generate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"market":"korea","businessName":"Test Dive Co","description":"Diving in Cebu","categories":["Coastal & Island"],"trend":"surging"}' | head -c 400
```

Expected: either a real generated body with `"source":"groq"`, or a 503 carrying
`dependency` and `cause`. A 200 with `"source":"fallback"` is now impossible.

- [ ] **Step 8: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/routers/content.py backend/fastapi-sbert/app/routers/creative.py backend/fastapi-sbert/app/agents/creative_director_agent/state.py backend/spring-boot/src/main/java/com/ceview/module3/dto/ContentDtos.java backend/fastapi-sbert/tests/unit/test_source_is_closed.py
git commit -m "feat(contract): make a fallback source unrepresentable"
```

---

## Phase 2 exit criteria

- [ ] `cd backend/fastapi-sbert && pytest tests/ -v` — all pass
- [ ] `cd backend/spring-boot && ./mvnw test` — all pass
- [ ] `grep -rn "_mock_captions\|_fallback_captions\|_FALLBACK_" backend/fastapi-sbert/app/` returns nothing
- [ ] `grep -rn "buildRuleBasedReport\|buildOfflinePesAnalysisFallback" backend/spring-boot/` returns nothing
- [ ] A live content-generate call returns `"source":"groq"` or a 503 with a cause —
      never a 200 with canned text
