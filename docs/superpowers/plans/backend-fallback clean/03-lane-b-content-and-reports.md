# Lane B — Content Generation, PES/Report, and Backend Naver Removal

> **REQUIRED SUB-SKILL:** superpowers:test-driven-development for every code step below.

**Goal:** every remaining canned-output fallback in `fastapi-sbert` and the
Spring `module4` report path is deleted and replaced with a raise; Naver is
removed from the AI services and Spring's content contract.

**Prerequisite:** Tasks 1–8, 17, 18 of the parent plan (already done — the
unavailability contract, and the caption-generation fallback already
deleted from `gemini_client.py` and `node.py`). **No dependency on the
trunk task** — start this immediately, in parallel with it. Backend Naver
removal (Tasks 26–27, below) doesn't need the frontend Naver removal (the
trunk) to land first either — different codebases, deleting different
things.

**Touches:** `fastapi-sbert/app/` (routers, services, agents — content,
creative, pes_analysis, pes_report_agent, report), Spring `module3` content
DTOs (`ContentDtos.java`, `ContentGenerationService.java`,
`LocalizedPromotionalContent.java`) and `module4/report/*`. No other lane
touches any of these.

**Internal sequencing — this lane is not internally parallel.** Tasks 19,
20, 25, 26, 27 repeatedly edit the same small cluster of files
(`gemini_client.py`, `content.py`, `creative.py`, `ContentDtos.java`) —
do them in the order given below, one at a time, even though you're the
only person on this lane. Tasks 21–24 (PES/report) touch entirely different
files and could technically be done in a different order relative to
19/20/25–27, but doing them in task-number order is simplest and matches
what's been tested together.

**A note on Task 21's async tests:** the plan's original text uses
`@pytest.mark.asyncio`, but this repo's `pytest` install has `anyio` and
`langsmith` plugins, not `pytest-asyncio`. Either add
`asyncio_mode = "auto"` under `[tool.pytest.ini_options]` in
`backend/fastapi-sbert/pyproject.toml`, or rewrite those two tests to use
`anyio`'s marker instead. Check which plugins are actually installed before
choosing:

```bash
cd backend/fastapi-sbert && pip list 2>/dev/null | grep -i "pytest\|anyio"
```

---

## Running

Docker stack, from `backend/`:

```bash
docker compose up -d && sleep 60
curl -s localhost:8001/healthz
```

`fastapi-sbert` downloads a ~1.1GB E5 encoder in its lifespan hook on first
start — the `sleep 60` is a cold-start margin, not required once it's warm.

Confirm the model is genuinely reachable before you start deleting
fallbacks that currently mask a broken one:

```bash
curl -s -X POST localhost:8001/internal/content/generate \
  -H 'Content-Type: application/json' \
  -d '{"market":"korea","businessName":"Test Dive Co","description":"Diving in Cebu","categories":["Coastal & Island"],"trend":"surging"}' \
  | grep -o '"source":"[a-zA-Z]*"'
```

Expected: `"source":"groq"`. If it says `"fallback"`, stop and check
`GROQ_API_KEY`/`GROQ_MODEL` in `backend/.env` before continuing — this lane
assumes a working model, same as the parent plan's Task 7 established.

## Testing

```bash
cd backend/fastapi-sbert && pytest tests/ -v
cd backend/spring-boot && ./mvnw test
```

## The tasks

Tasks 19–25 below are numbered as in the parent plan and appear in that
order — 19, 20, and 25 touch the content-generation cluster described
above; 21–24 (PES/report) are interleaved between them numerically but
touch unrelated files, so the order doesn't matter functionally. Tasks 26,
27, and 29 (Naver) follow.

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

### Task 26: Remove Naver from the AI services

**Files:**
- Modify: `backend/fastapi-sbert/app/routers/content.py:10,51-64,140-147,177-182,200-205`
- Modify: `backend/fastapi-sbert/app/services/gemini_client.py:220,227,622,669,699,729`
- Test: `backend/fastapi-sbert/tests/unit/test_no_naver.py`

- [ ] **Step 1: Write the failing test**

Create `backend/fastapi-sbert/tests/unit/test_no_naver.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_no_naver.py -v
```

Expected: FAIL — `_NAVER_OPTIONS` exists, guides include `naver`

- [ ] **Step 3: Strip Naver from `content.py`**

Delete `_NAVER_OPTIONS` (:52-63) and `_NAVER_OPTION_NAMES` (:64). Delete the
injection block at :177-182 in its entirety:

```python
    # ── Naver Blog (hardcoded — not generated by the 3-platform agent) ────────
    captions["naver"] = {
        "options":     _NAVER_OPTIONS,
        "optionNames": _NAVER_OPTION_NAMES,
        "guide":       guides.get("naver", []),
    }
```

Update the three docstrings that name Naver:

- :10 — `Visual guides and Naver Blog content come from gemini_client.get_platform_guides()`
  becomes `Visual guides come from gemini_client.get_platform_guides()`
- :140-147 — remove `For naver: inject hardcoded Korean blog content.` and drop
  `"naver"` from both the `guides:` and return-shape examples
- :200-205 — remove `Naver injected as hardcoded Korean blog content` and drop
  `naver` from the `captions —` line

- [ ] **Step 4: Strip Naver from `gemini_client.py`**

Delete the `NAVER` platform rule at :220 (the four-line block starting
`NAVER      Korean language only ·`) and the `- naver:     2 options in Korean
language + 5 visual guide tips (Korean audience)` line at :227.

Delete the `"naver": [...]` guide arrays at :622, :669, :699 and :729 — four
occurrences, each a list of five guidance strings ending with the
`"Minimum 1,500 characters with embedded map — Naver SEO depends heavily on content
depth."` entry. Update the `Returns:` docstring at :644 to
`{ "instagram": [...], "tiktok": [...], "facebook": [...] }`.

Task 17's `_caption_schema_example` already returns only the three platforms, so no
change is needed there.

- [ ] **Step 5: Confirm the kept sites are untouched**

```bash
cd backend/fastapi-sbert && grep -rn -i "naver" app/ | grep -v __pycache__
```

Expected: hits **only** in `routers/report.py` (`_PLATFORM_MAP` and the CPC
explanation), `services/cultural_research.py`, `routers/creative.py`'s FR3.16
docstring, `routers/pes_compute.py`'s review-snippet advice, and
`agents/pes_report_agent/prompt.py`'s CPC examples. Any hit in `content.py` or in
`gemini_client.py`'s caption path means Step 3 or 4 is incomplete.

- [ ] **Step 6: Run the tests**

```bash
cd backend/fastapi-sbert && pytest tests/ -v
```

Expected: PASS — including the 4 new ones

- [ ] **Step 7: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/routers/content.py backend/fastapi-sbert/app/services/gemini_client.py backend/fastapi-sbert/tests/unit/test_no_naver.py
git commit -m "feat(module-3): remove Naver as a generation target"
```

---

### Task 27: Remove Naver from Spring

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module3/dto/ContentDtos.java:10,39,59`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module3/submodule31/ContentGenerationService.java:154`
- Modify: `backend/spring-boot/src/main/java/com/ceview/module3/submodule31/LocalizedPromotionalContent.java:11`
- Test: `backend/spring-boot/src/test/java/com/ceview/module3/NoNaverPlatformTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.ceview.module3;

import com.ceview.module3.dto.ContentDtos;
import org.junit.jupiter.api.Test;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/** Three platforms, not four. The DTO is the contract the frontend narrows against. */
class NoNaverPlatformTest {

    @Test
    void contentResponseCarriesNoNaverComponent() {
        RecordComponent[] components = ContentDtos.ContentResponseDto.class.getRecordComponents();

        assertThat(Arrays.stream(components).map(RecordComponent::getName))
                .doesNotContain("naver");
    }

    @Test
    void theThreeRemainingPlatformsSurvive() {
        RecordComponent[] components = ContentDtos.ContentResponseDto.class.getRecordComponents();

        assertThat(Arrays.stream(components).map(RecordComponent::getName))
                .contains("instagram", "tiktok", "facebook");
    }
}
```

Adjust `ContentResponseDto` to the actual record name if it differs — check with
`grep -n "record " ContentDtos.java`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=NoNaverPlatformTest
```

Expected: FAIL — the `naver` component is present

- [ ] **Step 3: Implement**

In `ContentDtos.java`, delete the `PlatformContentDto naver` record component at
:59, including its trailing comma on the preceding line. Update :10 —
`Captions are split per-platform (Instagram / TikTok / Facebook / Naver).` becomes
`(Instagram / TikTok / Facebook).` Update :39's `may be shorter for Naver.` to drop
the clause.

In `ContentGenerationService.java`, delete :154:

```java
            if (caps.naver()     != null) platformMap.put("naver",     caps.naver());
```

In `LocalizedPromotionalContent.java`, :11 becomes
`Three rows are created per generate call (instagram, tiktok, facebook).`

- [ ] **Step 4: Let the compiler find the rest**

```bash
cd backend/spring-boot && ./mvnw compile
```

Expected: either clean, or errors naming every remaining `naver()` call site. Fix
each one — removing the record component is what makes them impossible to miss.

- [ ] **Step 5: Run the tests**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/module3/ backend/spring-boot/src/test/java/com/ceview/module3/NoNaverPlatformTest.java
git commit -m "feat(module-3): drop Naver from the Spring content contract"
```

### Task 29: `V24` — drop Naver content rows

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V24__module3_drop_naver_content.sql`

- [ ] **Step 1: See what exists before deleting**

```bash
cd backend && docker compose exec -T postgres psql -U ceview -d ceview -c \
  "SELECT platform, COUNT(*) FROM tbl_localized_promotional_content GROUP BY platform;"
```

Record the counts. Any `naver` row is the hardcoded Korean text from Task 26.

- [ ] **Step 2: Write the migration**

```sql
-- V24 — Remove stored Naver content.
--
-- Naver was dropped as a generation target in Task 26. Its captions were never
-- model output: two hardcoded Korean strings were injected on the success path of
-- every generate call (routers/content.py:177-182, pre-removal). Rows written
-- before that change are therefore canned text, and any query that does not
-- filter by platform would still surface them.
--
-- Data only — the platform column carries no CHECK constraint or enum, so
-- nothing structural needs to change.

DO $$
DECLARE removed INT;
BEGIN
    DELETE FROM tbl_localized_promotional_content WHERE platform = 'naver';
    GET DIAGNOSTICS removed = ROW_COUNT;
    RAISE NOTICE 'V24: removed % hardcoded Naver content rows', removed;
END $$;
```

- [ ] **Step 3: Apply and verify**

```bash
cd backend && docker compose restart spring-boot && sleep 30
docker compose logs spring-boot | grep -i "V24\|hardcoded Naver"
docker compose exec -T postgres psql -U ceview -d ceview -c \
  "SELECT COUNT(*) FROM tbl_localized_promotional_content WHERE platform = 'naver';"
```

Expected: the notice line, then a count of `0`.

- [ ] **Step 4: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/resources/db/migration/V24__module3_drop_naver_content.sql
git commit -m "feat(module-3): drop stored Naver content rows"
```


---

## Finished state

- [ ] `cd backend/fastapi-sbert && pytest tests/ -v` — all pass
- [ ] `cd backend/spring-boot && ./mvnw test` — all pass
- [ ] `grep -rn "_FALLBACK_SERVICES\|_creative_fallback\|_FALLBACK_PAYLOAD\|_FALLBACK_REPORT\|_FALLBACK_EVALUATION\|_fallback_report" backend/fastapi-sbert/app/` — no output
- [ ] `grep -rn "buildRuleBasedReport\|buildOfflinePesAnalysisFallback" backend/spring-boot/` — no output
- [ ] `grep -rni "naver" backend/fastapi-sbert/app/ backend/spring-boot/src/main` — no output (recommendations in `report.py`/`cultural_research.py` are the documented exception — see the parent plan's Naver task for exactly which references are deliberately kept)
- [ ] `SELECT COUNT(*) FROM tbl_localized_promotional_content WHERE platform='naver'` returns 0
- [ ] A live content-generate call returns `"source":"groq"` or a 503 with a `cause` — never a 200 with canned text
- [ ] `git log` shows this lane's commits — independent of the trunk and Lane A, can merge in any order relative to them
