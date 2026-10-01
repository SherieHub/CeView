# Phase 0 — Baseline

**Goal:** Prove every existing suite is green *before* any change and record the numbers, so later
regressions are attributable to the phase that caused them.

**Files:**
- Create: `docs/superpowers/plans/2026-09-10-module-2-e2e/baseline-results.md`

### Task 0.1: Run and record every suite

- [ ] **Step 1: FastAPI transformer** — in `backend/fastapi-transformer`: `pytest tests/ -v`
Expected: all pass (`tests/unit/test_example_unit.py`, `test_trend_service_no_stub.py`,
`test_unavailable.py`, `tests/integration/test_healthz.py`). `tests/conftest.py` sets a placeholder
`GROQ_API_KEY` because `gemini_forecaster.py` still raises at import time today.

- [ ] **Step 2: Spring Boot** — in `backend/spring-boot`: `./mvnw -B test`
Expected: `BUILD SUCCESS`. Record the `Tests run:` total.

- [ ] **Step 3: Frontend** — in `frontend`: `npm run test:unit`, then `npm run test:integration`, then `npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 4: Live stack, contract test, journey**

```bash
cd backend && docker compose up -d --build
cd ../frontend && npm run test:contract
cd ../e2e && npx playwright test tests/journey.spec.ts
```

Expected: contract tests pass (they skip if the stack is down); journey passes. If `journey.spec.ts`
fails today, record the failure verbatim — a later phase must not be blamed for a pre-existing break.
Note for later: `journey.spec.ts:67, 86, 186` assert the title `Demand Surge Detected — South Korea`,
which contract §6 replaces; Phase 4 updates those lines.

- [ ] **Step 5: Record** — write `baseline-results.md`:

```markdown
# Module 2 E2E — Baseline (before Phase 1)

| Suite | Command | Result | Count |
|---|---|---|---|
| fastapi-transformer | pytest tests/ -v | PASS/FAIL | N passed |
| spring-boot | ./mvnw -B test | PASS/FAIL | Tests run: N |
| frontend unit | npm run test:unit | PASS/FAIL | N passed |
| frontend integration | npm run test:integration | PASS/FAIL | N passed |
| frontend build | npm run build | PASS/FAIL | — |
| contract | npm run test:contract | PASS/SKIP/FAIL | N |
| journey e2e | npx playwright test tests/journey.spec.ts | PASS/SKIP/FAIL | N |

Pre-existing failures (verbatim):
- (none)
```

- [ ] **Step 6: Checkpoint** — hand back to the user. Suggested commit message:
`docs(module-2): record e2e completion baseline`

## Phase 0 exit gate

- `baseline-results.md` exists with every row filled in.
- Any pre-existing failure is listed verbatim.
