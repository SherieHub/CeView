# Phase 0 — The Unavailability Contract (Tasks 1–7)

Nothing is deleted in this phase. Every service gains the vocabulary for saying
"unavailable, and here is why", so the later phases have somewhere to fail *to*.

**Prerequisite:** none. This phase must complete before any other.

---

### Task 1: `DependencyUnavailable` + handler in `fastapi-sbert`

**Files:**
- Create: `backend/fastapi-sbert/app/unavailable.py`
- Modify: `backend/fastapi-sbert/app/main.py:34-50`
- Test: `backend/fastapi-sbert/tests/unit/test_unavailable.py`

- [ ] **Step 1: Write the failing test**

Create `backend/fastapi-sbert/tests/unit/test_unavailable.py`:

```python
"""DependencyUnavailable renders the one wire shape every CeView service speaks.

Run with: pytest tests/unit/test_unavailable.py -v
"""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.unavailable import DependencyUnavailable, register_unavailable_handler


def _client() -> TestClient:
    app = FastAPI()
    register_unavailable_handler(app)

    @app.get("/boom")
    def boom():
        raise DependencyUnavailable(
            code="MOD31_LLM_UNAVAILABLE",
            message="Caption generation is unavailable.",
            dependency="groq",
            cause="GROQ_API_KEY is not set",
            stage="fastapi-sbert/caption_agent",
        )

    @app.get("/missing-input")
    def missing_input():
        raise DependencyUnavailable(
            code="MOD31_NO_CORE_SERVICES",
            message="Business profile has no core services.",
            dependency="business_profile",
            cause="coreServices was empty",
            stage="fastapi-sbert/caption_agent",
            status_code=424,
        )

    return TestClient(app)


def test_renders_the_full_wire_shape():
    response = _client().get("/boom")

    assert response.status_code == 503
    assert response.json() == {
        "code": "MOD31_LLM_UNAVAILABLE",
        "message": "Caption generation is unavailable.",
        "dependency": "groq",
        "cause": "GROQ_API_KEY is not set",
        "stage": "fastapi-sbert/caption_agent",
    }


def test_missing_upstream_input_is_424_not_503():
    response = _client().get("/missing-input")

    assert response.status_code == 424
    assert response.json()["code"] == "MOD31_NO_CORE_SERVICES"
    assert response.json()["dependency"] == "business_profile"


def test_cause_is_required():
    import pytest

    with pytest.raises(TypeError):
        DependencyUnavailable(  # type: ignore[call-arg]
            code="X", message="y", dependency="z", stage="s"
        )
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_unavailable.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.unavailable'`

- [ ] **Step 3: Write the implementation**

Create `backend/fastapi-sbert/app/unavailable.py`:

```python
"""The one way a CeView service says "I cannot do this, and here is why".

Every AI-backed endpoint either returns a real model output or raises this. There
is no third option: no canned captions, no deterministic placeholder reports, no
"source: fallback" payload that looks like success. See
docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md §Section 1.

`cause` is written once, here at the site that actually knows why, and is never
re-worded on the way up. Spring re-emits the body verbatim (Task 4) and the
frontend renders it verbatim (Task 6), so a developer reading the browser sees the
same sentence the service logged.

Status code:
  503 — a dependency we own or call is unavailable (model, API key, PyTrends)
  424 — a required upstream *input* is absent (empty metrics, no core services).
        Distinct because retrying will not help; the caller must supply the input.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DependencyUnavailable(Exception):
    """Raised instead of returning synthetic data."""

    def __init__(
        self,
        *,
        code: str,
        message: str,
        dependency: str,
        cause: str,
        stage: str,
        status_code: int = 503,
    ) -> None:
        super().__init__(f"{code}: {message} ({dependency}: {cause})")
        self.code = code
        self.message = message
        self.dependency = dependency
        self.cause = cause
        self.stage = stage
        self.status_code = status_code

    def to_body(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "dependency": self.dependency,
            "cause": self.cause,
            "stage": self.stage,
        }


def register_unavailable_handler(app: FastAPI) -> None:
    """Wire the handler onto a FastAPI app. Call once, at app construction."""

    @app.exception_handler(DependencyUnavailable)
    async def _handle(_request: Request, exc: DependencyUnavailable) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_body())
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_unavailable.py -v
```

Expected: PASS — 3 passed

- [ ] **Step 5: Register the handler on the real app**

In `backend/fastapi-sbert/app/main.py`, add the import beside the other `app.`
imports near the top of the file:

```python
from app.unavailable import register_unavailable_handler
```

Then immediately after the `app = FastAPI(...)` line at :34, before the first
`app.include_router(...)` at :43:

```python
register_unavailable_handler(app)
```

- [ ] **Step 6: Verify the app still boots**

```bash
cd backend/fastapi-sbert && pytest tests/integration/test_healthz.py -v
```

Expected: PASS — 1 passed

- [ ] **Step 7: Delete the orphaned compliance codes**

`app/errors.py:33-35` declares `MOD3_COMPLIANCE_GEMINI_DISABLED`,
`MOD3_COMPLIANCE_GEMINI_EMPTY` and `MOD3_COMPLIANCE_GEMINI_EXCEPTION`. Nothing
references them — `omcs_analysis.py` uses `MOD33_OMCS_AGENT_FAILED` instead. Confirm,
then remove:

```bash
cd backend/fastapi-sbert && grep -rn "MOD3_COMPLIANCE_GEMINI" app/ --include=*.py
```

Expected: three hits, all in `app/errors.py` itself. Delete those three lines. A
registry of codes that cannot be emitted is a map to failures that do not exist.

Re-verify:

```bash
cd backend/fastapi-sbert && grep -rn "MOD3_COMPLIANCE_GEMINI" app/ ; echo "exit=$?"
```

Expected: no output, `exit=1`

- [ ] **Step 8: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/unavailable.py backend/fastapi-sbert/app/main.py backend/fastapi-sbert/app/errors.py backend/fastapi-sbert/tests/unit/test_unavailable.py
git commit -m "feat(contract): add DependencyUnavailable to fastapi-sbert"
```

---

### Task 2: `DependencyUnavailable` + handler in `fastapi-transformer`

The two FastAPI services are separately deployed with no shared package, so this is
a deliberate copy rather than an extracted library. Keeping them byte-identical is
cheaper than introducing a shared distribution for 60 lines.

**Files:**
- Create: `backend/fastapi-transformer/app/unavailable.py`
- Modify: `backend/fastapi-transformer/app/main.py:13-50`
- Test: `backend/fastapi-transformer/tests/unit/test_unavailable.py`

- [ ] **Step 1: Write the failing test**

Create `backend/fastapi-transformer/tests/unit/test_unavailable.py`:

```python
"""Mirror of fastapi-sbert's test — the two services must speak the same shape.

Run with: pytest tests/unit/test_unavailable.py -v
"""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.unavailable import DependencyUnavailable, register_unavailable_handler


def _client() -> TestClient:
    app = FastAPI()
    register_unavailable_handler(app)

    @app.get("/boom")
    def boom():
        raise DependencyUnavailable(
            code="MOD21_TRENDS_UNAVAILABLE",
            message="Google Trends data is unavailable.",
            dependency="pytrends",
            cause="429 Too Many Requests",
            stage="fastapi-transformer/trend_service",
        )

    return TestClient(app)


def test_renders_the_full_wire_shape():
    response = _client().get("/boom")

    assert response.status_code == 503
    assert response.json() == {
        "code": "MOD21_TRENDS_UNAVAILABLE",
        "message": "Google Trends data is unavailable.",
        "dependency": "pytrends",
        "cause": "429 Too Many Requests",
        "stage": "fastapi-transformer/trend_service",
    }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-transformer && pytest tests/unit/test_unavailable.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.unavailable'`

- [ ] **Step 3: Copy the implementation**

Copy `backend/fastapi-sbert/app/unavailable.py` to
`backend/fastapi-transformer/app/unavailable.py` verbatim, changing only the
docstring's second paragraph to read:

```python
"""The one way a CeView service says "I cannot do this, and here is why".

Every externally-sourced value either comes from a real fetch or raises this. There
is no third option: no deterministic stub trend series, no straight-line GDP curve.
See docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md §Section 1.

This is a deliberate copy of fastapi-sbert/app/unavailable.py — the two services
deploy separately with no shared package. Keep them identical.

Status code:
  503 — a dependency we own or call is unavailable (PyTrends, Groq, World Bank)
  424 — a required upstream *input* is absent. Distinct because retrying will not
        help; the caller must supply the input.
"""
```

The class and function bodies are unchanged.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend/fastapi-transformer && pytest tests/unit/test_unavailable.py -v
```

Expected: PASS — 1 passed

- [ ] **Step 5: Register the handler on the real app**

In `backend/fastapi-transformer/app/main.py`, add beside the other `app.` imports:

```python
from app.unavailable import register_unavailable_handler
```

Then after the `app = FastAPI(` block ending before :48, and before the first
`app.include_router(...)`:

```python
register_unavailable_handler(app)
```

- [ ] **Step 6: Verify the app still boots**

```bash
cd backend/fastapi-transformer && pytest tests/integration/test_healthz.py -v
```

Expected: PASS — 1 passed

- [ ] **Step 7: Commit** *(operator runs this)*

```bash
git add backend/fastapi-transformer/app/unavailable.py backend/fastapi-transformer/app/main.py backend/fastapi-transformer/tests/unit/test_unavailable.py
git commit -m "feat(contract): add DependencyUnavailable to fastapi-transformer"
```

---

### Task 3: `AgentLLMModel` records why initialisation failed

Today `get_model()` returns bare `None` and the reason is only in a log line. Task 18
needs that reason as a `cause` string, so it has to be captured on the object.

**Files:**
- Modify: `backend/fastapi-sbert/app/core/AgentLLMModel.py:31-70`
- Test: `backend/fastapi-sbert/tests/unit/test_agent_llm_model.py`

- [ ] **Step 1: Write the failing test**

Create `backend/fastapi-sbert/tests/unit/test_agent_llm_model.py`:

```python
"""AgentLLMModel must report *why* it has no model, not just that it has none.

Task 18 turns that reason into the `cause` field of a 503. Without it the operator
sees "LLM unavailable" with no way to tell an unset key from a dead model id.

Run with: pytest tests/unit/test_agent_llm_model.py -v
"""
import pytest

from app.core.AgentLLMModel import AgentLLMModel


@pytest.fixture(autouse=True)
def _reset_singleton():
    AgentLLMModel._instance = None
    yield
    AgentLLMModel._instance = None


def test_unset_api_key_is_reported_as_the_cause(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is None
    assert wrapper.last_error == "GROQ_API_KEY is not set"


def test_initialisation_failure_is_reported_as_the_cause(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "sk-test")
    monkeypatch.setenv("GROQ_MODEL", "some-model")

    def _explode(*_args, **_kwargs):
        raise RuntimeError("connection refused")

    monkeypatch.setattr("langchain_groq.ChatGroq", _explode)

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is None
    assert "connection refused" in wrapper.last_error
    assert "some-model" in wrapper.last_error


def test_last_error_is_cleared_once_a_model_initialises(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "sk-test")
    monkeypatch.setattr("langchain_groq.ChatGroq", lambda **_kwargs: object())

    wrapper = AgentLLMModel()

    assert wrapper.get_model() is not None
    assert wrapper.last_error is None
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_agent_llm_model.py -v
```

Expected: FAIL — `AttributeError: 'AgentLLMModel' object has no attribute 'last_error'`

- [ ] **Step 3: Write the implementation**

In `backend/fastapi-sbert/app/core/AgentLLMModel.py`, replace `__new__` and
`_initialize` (currently :22-70) with:

```python
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AgentLLMModel, cls).__new__(cls)
                cls._instance._model = None
                cls._instance.last_error = None
                cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Attempts to build the LangChain Groq model.

        On failure, records the reason in `last_error` as a single sentence fit to
        be shown to a developer in the browser — Task 18 passes it straight through
        as the `cause` field of a 503 (see app/unavailable.py).
        """
        api_key = os.environ.get("GROQ_API_KEY", "")

        if not api_key:
            self.last_error = "GROQ_API_KEY is not set"
            return

        # Groq decommissions models periodically; when that happens the API answers
        # 404 model_not_found while the key still authenticates. Naming the model in
        # last_error is what makes that distinguishable from an auth failure.
        groq_model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

        try:
            from langchain_groq import ChatGroq  # type: ignore[import]

            self._model = ChatGroq(
                model=groq_model,
                temperature=0.7,
                groq_api_key=api_key,
            )
            self.last_error = None
            logger.info("AgentLLMModel: ChatGroq initialised (model=%s).", groq_model)

        except ImportError as exc:
            self.last_error = f"langchain-groq is not installed ({exc})"
            logger.error("AgentLLMModel: %s", self.last_error)
        except Exception as exc:
            self.last_error = (
                f"ChatGroq failed to initialise with GROQ_MODEL '{groq_model}': {exc}"
            )
            logger.error("AgentLLMModel: %s", self.last_error)
```

Note the `import ChatGroq` moved *inside* the `try` alongside the constructor so a
monkeypatched `langchain_groq.ChatGroq` is resolved at call time — the test depends
on this.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend/fastapi-sbert && pytest tests/unit/test_agent_llm_model.py -v
```

Expected: PASS — 3 passed

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add backend/fastapi-sbert/app/core/AgentLLMModel.py backend/fastapi-sbert/tests/unit/test_agent_llm_model.py
git commit -m "feat(contract): AgentLLMModel records its initialisation failure cause"
```

---

### Task 4: Spring gateway passes the 503 body through verbatim

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/ai/AiDependencyException.java`
- Create: `backend/spring-boot/src/main/java/com/ceview/ai/AiDependencyExceptionHandler.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/ai/AiDependencyPassthroughTest.java`

- [ ] **Step 1: Write the failing test**

Create `backend/spring-boot/src/test/java/com/ceview/ai/AiDependencyPassthroughTest.java`:

```java
package com.ceview.ai;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A FastAPI 503 carrying the unavailability contract must reach the browser with
 * its `cause` unchanged. Re-wording it here would defeat the whole point: the
 * developer needs the sentence written by the service that actually knows why.
 */
class AiDependencyPassthroughTest {

    @Test
    void parsesTheContractBodyIntoAnException() {
        Map<String, Object> body = Map.of(
                "code", "MOD31_LLM_UNAVAILABLE",
                "message", "Caption generation is unavailable.",
                "dependency", "groq",
                "cause", "GROQ_API_KEY is not set",
                "stage", "fastapi-sbert/caption_agent");

        AiDependencyException ex = AiDependencyException.fromBody(503, body, "content/generate");

        assertThat(ex.getCode()).isEqualTo("MOD31_LLM_UNAVAILABLE");
        assertThat(ex.getDependency()).isEqualTo("groq");
        assertThat(ex.getCause2()).isEqualTo("GROQ_API_KEY is not set");
        assertThat(ex.getStatus()).isEqualTo(503);
    }

    @Test
    void appendsItsOwnHopToTheStage() {
        Map<String, Object> body = Map.of(
                "code", "X", "message", "y", "dependency", "groq",
                "cause", "z", "stage", "fastapi-sbert/caption_agent");

        AiDependencyException ex = AiDependencyException.fromBody(503, body, "content/generate");

        assertThat(ex.getStage())
                .isEqualTo("fastapi-sbert/caption_agent -> spring/content/generate");
    }

    @Test
    void aBodyWithoutTheContractIsNotSwallowed() {
        AiDependencyException ex =
                AiDependencyException.fromBody(502, Map.of(), "content/generate");

        assertThat(ex.getCode()).isEqualTo("AI_SERVICE_UNREACHABLE");
        assertThat(ex.getDependency()).isEqualTo("fastapi");
        assertThat(ex.getCause2()).contains("502");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=AiDependencyPassthroughTest
```

Expected: FAIL — compilation error, `AiDependencyException` does not exist

- [ ] **Step 3: Write the exception**

Create `backend/spring-boot/src/main/java/com/ceview/ai/AiDependencyException.java`:

```java
package com.ceview.ai;

import java.util.Map;

/**
 * A FastAPI dependency failure, carried to the browser without re-wording.
 *
 * <p>The `cause` string is authored by the service that knows why (see each
 * service's app/unavailable.py) and passes through Spring untouched. The only
 * thing Spring adds is its own hop on `stage`, so the chain is visible.
 *
 * <p>Note {@code getCause2()} rather than {@code getCause()} — {@link Throwable}
 * already owns that name for a different purpose.
 */
public class AiDependencyException extends RuntimeException {

    private final int status;
    private final String code;
    private final String dependency;
    private final String causeText;
    private final String stage;

    private AiDependencyException(
            int status, String code, String message, String dependency, String causeText, String stage) {
        super(message);
        this.status = status;
        this.code = code;
        this.dependency = dependency;
        this.causeText = causeText;
        this.stage = stage;
    }

    /**
     * Builds one from a FastAPI error body. A body that does not carry the
     * contract still produces an exception naming the transport failure — it is
     * never collapsed into a generic "something went wrong".
     */
    public static AiDependencyException fromBody(int status, Map<String, Object> body, String springPath) {
        String code = str(body, "code");
        String upstreamStage = str(body, "stage");

        if (code == null) {
            return new AiDependencyException(
                    status,
                    "AI_SERVICE_UNREACHABLE",
                    "The AI service did not respond with a usable error.",
                    "fastapi",
                    "HTTP " + status + " with no unavailability body",
                    "spring/" + springPath);
        }

        return new AiDependencyException(
                status,
                code,
                str(body, "message"),
                str(body, "dependency"),
                str(body, "cause"),
                upstreamStage == null
                        ? "spring/" + springPath
                        : upstreamStage + " -> spring/" + springPath);
    }

    private static String str(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value instanceof String s ? s : null;
    }

    public Map<String, Object> toBody() {
        return Map.of(
                "code", code,
                "message", getMessage() == null ? "" : getMessage(),
                "dependency", dependency == null ? "" : dependency,
                "cause", causeText == null ? "" : causeText,
                "stage", stage == null ? "" : stage);
    }

    public int getStatus()        { return status; }
    public String getCode()       { return code; }
    public String getDependency() { return dependency; }
    public String getCause2()     { return causeText; }
    public String getStage()      { return stage; }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend/spring-boot && ./mvnw test -Dtest=AiDependencyPassthroughTest
```

Expected: PASS — 3 tests

- [ ] **Step 5: Add the exception handler**

Create `backend/spring-boot/src/main/java/com/ceview/ai/AiDependencyExceptionHandler.java`:

```java
package com.ceview.ai;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Renders {@link AiDependencyException} as the unavailability contract body. */
@RestControllerAdvice
public class AiDependencyExceptionHandler {

    @ExceptionHandler(AiDependencyException.class)
    public ResponseEntity<Map<String, Object>> handle(AiDependencyException ex) {
        return ResponseEntity.status(ex.getStatus()).body(ex.toBody());
    }
}
```

- [ ] **Step 6: Throw it from the gateway**

In `AIInferenceGatewayService.java`, find the `ResponseStatusException` thrown at
:134 and the surrounding error-handling block. Replace the throw with:

```java
            throw AiDependencyException.fromBody(
                    status.value(),
                    errorBody == null ? java.util.Map.of() : errorBody,
                    path);
```

where `errorBody` is the parsed JSON map from the FastAPI response and `path` is the
gateway method's endpoint segment. If the existing code does not already parse the
error body into a `Map`, parse it with the same `MAP_TYPE` reader used at :280,
guarding non-JSON bodies the way :296-298 already does.

- [ ] **Step 7: Verify the whole backend still compiles and passes**

```bash
cd backend/spring-boot && ./mvnw test
```

Expected: PASS — all existing tests green plus the 3 new ones

- [ ] **Step 8: Commit** *(operator runs this)*

```bash
git add backend/spring-boot/src/main/java/com/ceview/ai/ backend/spring-boot/src/test/java/com/ceview/ai/
git commit -m "feat(contract): pass FastAPI unavailability bodies through Spring verbatim"
```

---

### Task 5: `ApiError` carries `dependency` / `cause` / `stage`

**Files:**
- Modify: `frontend/services/apiError.ts`
- Test: `frontend/services/apiError.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `frontend/services/apiError.test.ts`:

```typescript
describe('unavailability contract fields', () => {
  const contractBody = {
    code: 'MOD31_LLM_UNAVAILABLE',
    message: 'Caption generation is unavailable.',
    dependency: 'groq',
    cause: "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found",
    stage: 'fastapi-sbert/caption_agent -> spring/content/generate',
  };

  it('parses dependency, cause and stage off the body', () => {
    const err = new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate', body: contractBody,
    });

    expect(err.dependency).toBe('groq');
    expect(err.cause).toContain('404 model_not_found');
    expect(err.stage).toContain('spring/content/generate');
  });

  it('classifies anything carrying a dependency as a missing dependency', () => {
    const err = new ApiError({
      status: 503, method: 'POST', path: '/api/content/generate', body: contractBody,
    });

    expect(isMissingDependency(err)).toBe(true);
  });

  it('does not classify an ordinary failure as a missing dependency', () => {
    const err = new ApiError({
      status: 500, method: 'GET', path: '/api/notifications',
      body: { code: 'MOD22_UNEXPECTED', message: 'boom' },
    });

    expect(isMissingDependency(err)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run services/apiError.test.ts
```

Expected: FAIL — `err.dependency` is `undefined`

- [ ] **Step 3: Write the implementation**

In `frontend/services/apiError.ts`, add three readonly fields to `ApiError` and set
them in the constructor, immediately after the existing `this.code` assignment:

```typescript
  readonly dependency?: string;
  readonly cause?: string;
  readonly stage?: string;
```

```typescript
    // The unavailability contract (spec §Section 1). `cause` is authored by the
    // service that knows why and is rendered verbatim — never re-worded here.
    this.dependency = readString(body, 'dependency');
    this.cause = readString(body, 'cause');
    this.stage = readString(body, 'stage');
```

Then replace `isMissingDependency` and delete the `MISSING_DEPENDENCY_CODES` set
above it:

```typescript
/**
 * "This dependency is unavailable", not "the request failed".
 *
 * Presence of `dependency` is the signal, replacing the hardcoded code allowlist
 * this function used to carry — enumerating codes meant every new code had to be
 * added here too, and silently misclassified until someone noticed.
 */
export function isMissingDependency(err: unknown): boolean {
  return err instanceof ApiError && typeof err.dependency === 'string' && err.dependency.length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run services/apiError.test.ts
```

Expected: PASS

- [ ] **Step 5: Run the whole frontend suite for regressions**

```bash
cd frontend && npm test
```

Expected: PASS. If a test asserted the old allowlist behaviour (e.g. that
`'ai_service_unreachable'` classifies with no `dependency` field), update it to
supply a `dependency` — Task 4 guarantees Spring now always sends one.

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add frontend/services/apiError.ts frontend/services/apiError.test.ts
git commit -m "feat(contract): ApiError carries dependency, cause and stage"
```

---

### Task 6: `ApiErrorPanel` renders them

**Files:**
- Modify: `frontend/components/shared/ApiErrorPanel.tsx`
- Test: `frontend/components/shared/ApiErrorPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `frontend/components/shared/ApiErrorPanel.test.tsx`:

```typescript
describe('unavailability contract rendering', () => {
  const unavailable = new ApiError({
    status: 503,
    method: 'POST',
    path: '/api/content/generate',
    body: {
      code: 'MOD31_LLM_UNAVAILABLE',
      message: 'Caption generation is unavailable.',
      dependency: 'groq',
      cause: "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found",
      stage: 'fastapi-sbert/caption_agent -> spring/content/generate',
    },
  });

  it('names the dependency in the heading', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByRole('alert')).toHaveTextContent('groq is unavailable');
  });

  it('renders the cause verbatim', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByTestId('api-error-cause')).toHaveTextContent(
      "GROQ_MODEL 'llama-3.3-70b-versatile' returned 404 model_not_found",
    );
  });

  it('renders the stage chain', () => {
    render(<ApiErrorPanel error={unavailable} />);

    expect(screen.getByTestId('api-error-stage')).toHaveTextContent(
      'fastapi-sbert/caption_agent -> spring/content/generate',
    );
  });

  it('offers no retry for an unavailable dependency', () => {
    render(<ApiErrorPanel error={unavailable} onRetry={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run components/shared/ApiErrorPanel.test.tsx
```

Expected: FAIL — no element with `data-testid="api-error-cause"`

- [ ] **Step 3: Write the implementation**

In `frontend/components/shared/ApiErrorPanel.tsx`, change the `heading` and the
explanatory paragraph so a named dependency identifies itself, then add the two new
`<dl>` rows.

Replace the `heading` const:

```typescript
  const heading = missing
    ? api?.dependency
      ? `${api.dependency} is unavailable`
      : 'Setup required'
    : notReady
      ? 'Complete onboarding first'
      : 'Something went wrong';
```

Replace the explanatory paragraph's `missing` branch:

```typescript
        {missing
          ? 'This screen needs a dependency that is not answering. Nothing below is simulated — the data is simply not available.'
          : notReady
            ? 'This screen needs a saved business profile before it can load data.'
            : 'The request to the backend did not succeed.'}
```

Inside the existing `{api && (<dl …>)}` block, after the Message row, add:

```tsx
          {api.cause && (
            <div>
              <dt className="sr-only">Cause</dt>
              <dd data-testid="api-error-cause" className="whitespace-pre-wrap">
                {api.cause}
              </dd>
            </div>
          )}
          {api.stage && (
            <div>
              <dt className="sr-only">Stage</dt>
              <dd data-testid="api-error-stage">{api.stage}</dd>
            </div>
          )}
```

The existing `onRetry && !missing && !notReady` guard already suppresses Retry for
dependency failures, so no change is needed there.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run components/shared/ApiErrorPanel.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit** *(operator runs this)*

```bash
git add frontend/components/shared/ApiErrorPanel.tsx frontend/components/shared/ApiErrorPanel.test.tsx
git commit -m "feat(contract): ApiErrorPanel names the dependency and shows the cause"
```

---

### Task 7: Fix `GROQ_MODEL` and `OMCS_VISION_MODEL` defaults

The predecessor plan found `llama-3.3-70b-versatile` decommissioned — Groq answers
`404 model_not_found` while the key still authenticates. With Phase 2's fallbacks
gone this becomes a hard failure on every AI call, so it must be fixed in the same
pass.

**Files:**
- Modify: `backend/docker-compose.yml:25,56`
- Modify: `backend/fastapi-sbert/app/core/AgentLLMModel.py` (the default at the
  `groq_model = os.environ.get(...)` line rewritten in Task 3)
- Modify: `backend/fastapi-sbert/app/services/gemini_client.py` (its `GROQ_MODEL`
  default)

- [ ] **Step 1: Find every default**

```bash
cd backend && grep -rn "llama-3.3-70b-versatile" --include=*.yml --include=*.py --include=*.java --include=*.env* .
```

Expected: hits in `docker-compose.yml` (2), `AgentLLMModel.py` (1),
`gemini_client.py` (1). Record the exact list — every one gets changed.

- [ ] **Step 2: Replace them**

```bash
cd backend && grep -rl "llama-3.3-70b-versatile" --include=*.yml --include=*.py . \
  | xargs sed -i 's/llama-3.3-70b-versatile/openai\/gpt-oss-120b/g'
```

- [ ] **Step 3: Find the OMCS vision model default**

```bash
cd backend && grep -rn "OMCS_VISION_MODEL" --include=*.yml --include=*.py .
```

Set its default to `meta-llama/llama-4-scout-17b-16e-instruct`, a vision-capable
Groq model. If your key cannot reach that one either, pick one it can from
`https://console.groq.com/docs/models` — the requirement is that the default is a
model the project's key actually serves, not this specific id.

- [ ] **Step 4: Verify no decommissioned default survives**

```bash
cd backend && grep -rn "llama-3.3-70b-versatile" . ; echo "exit=$?"
```

Expected: no output, `exit=1`

- [ ] **Step 5: Verify against the live stack**

```bash
cd backend && docker compose up -d && sleep 60
curl -s localhost:8001/healthz
```

Expected: `{"status":"ok"}`. Then confirm the model actually answers:

```bash
curl -s -X POST localhost:8001/internal/content/generate \
  -H 'Content-Type: application/json' \
  -d '{"market":"korea","businessName":"Test Dive Co","description":"Diving in Cebu","categories":["Coastal & Island"],"trend":"surging"}' \
  | head -c 400
```

Expected: a JSON body with `"source": "groq"`. If it shows `"source": "fallback"`,
the model id is still wrong — fix it before continuing, because Phase 2 removes the
fallback that is currently hiding this.

- [ ] **Step 6: Commit** *(operator runs this)*

```bash
git add backend/docker-compose.yml backend/fastapi-sbert/app/core/AgentLLMModel.py backend/fastapi-sbert/app/services/gemini_client.py
git commit -m "fix(config): point GROQ_MODEL and OMCS_VISION_MODEL at reachable models"
```

---

## Phase 0 exit criteria

- [ ] `cd backend/fastapi-sbert && pytest tests/ -v` — all pass
- [ ] `cd backend/fastapi-transformer && pytest tests/ -v` — all pass
- [ ] `cd backend/spring-boot && ./mvnw test` — all pass
- [ ] `cd frontend && npm test` — all pass
- [ ] `grep -rn "llama-3.3-70b-versatile" backend/` returns nothing
- [ ] A live `POST /internal/content/generate` returns `"source": "groq"`

Nothing has been deleted yet. The tree behaves exactly as before, except that
misconfiguration is now reported with a cause instead of silently swallowed.
